const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain, generateOrderNumber } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const cartService = require("../cart/cart.service");
const settingsService = require("../settings/settings.service");
const promotionsService = require("../promotions/promotions.service");
const notificationsService = require("../notifications/notifications.service");
const { logActivity } = require("../../utils/activityLog");
const { calculateTotals, pickBestPromotion } = require("../../utils/pricing");
const fulfillmentService = require("../fulfillment/fulfillment.service");
const inventoryService = require("../inventory/inventory.service");
const { isRestockingTransition, restockTypeFor, isCancellableByCustomer } = require("./orderStateMachine");
const { resolveShipmentProvider } = require("../shipping/shipmentProviders");

const ORDER_INCLUDE = {
  items: true,
  shippingAddress: true,
  shippingMethod: true,
  coupon: true,
  store: true,
};

/**
 * Creates one Order per store represented in the cart (a single checkout
 * can span multiple sellers once the platform has more than one store;
 * shared costs — coupon discount/shipping — are split proportionally by
 * each store's share of the cart subtotal; tax/platform fee come from the
 * live Settings row, never a hardcoded constant).
 */
async function createFromCart(userId, { shippingAddressId, shippingMethodId, paymentMethod }) {
  const cart = await cartService.getOrCreateCart({ userId });
  if (cart.items.length === 0) throw ApiError.badRequest("Your cart is empty.");

  const address = await prisma.address.findUnique({ where: { id: shippingAddressId } });
  if (!address || address.userId !== userId) throw ApiError.notFound("Shipping address not found.");

  const shippingMethod = await prisma.shippingMethod.findUnique({ where: { id: shippingMethodId } });
  if (!shippingMethod) throw ApiError.notFound("Shipping method not found.");

  const settings = await settingsService.getOrCreate();
  const flags = settingsService.resolveFeatureFlags(settings);
  if (paymentMethod === "cod" && !flags.cod) {
    throw ApiError.badRequest("Cash on delivery is currently unavailable.");
  }
  const codCharge = paymentMethod === "cod" ? Number(settings.codCharge || 0) : 0;
  const isFirstOrder = (await prisma.order.count({ where: { userId } })) === 0;
  const vipTiers = settingsService.resolveVipTiers(settings);
  const orderingUser = await prisma.user.findUnique({ where: { id: userId }, select: { vipTier: true } });
  const hasVipFreeShipping = vipTiers.enabled && Boolean(orderingUser?.vipTier);

  const productIds = cart.items.map((i) => i.productId);
  const variantIds = cart.items.map((i) => i.variantId).filter(Boolean);
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, include: { store: true } }),
    variantIds.length ? prisma.productVariant.findMany({ where: { id: { in: variantIds } } }) : Promise.resolve([]),
  ]);
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));
  const variantById = Object.fromEntries(variants.map((v) => [v.id, v]));

  for (const product of products) {
    if (product.store.status !== "approved") {
      throw ApiError.badRequest(`"${product.name}" is currently unavailable for purchase.`);
    }
  }

  // Re-price every line item server-side (never trust the client/cart cache for the charge amount).
  const activePromotions = await promotionsService.listActive();
  const firstOrderPromotions = isFirstOrder ? activePromotions.filter((p) => p.type === "first_order") : [];

  let subtotal = 0;
  let promotionDiscount = 0;
  const priced = [];

  for (const item of cart.items) {
    const product = productById[item.productId];
    if (!product) throw ApiError.notFound(`Product ${item.productId} no longer exists.`);

    const variant = item.variantId ? variantById[item.variantId] : null;
    const stock = variant ? variant.stock : product.stock;
    if (stock < item.quantity) throw ApiError.badRequest(`"${product.name}" only has ${stock} left in stock.`);

    const unitPrice = Number(variant?.price ?? item.priceSnapshot);
    const { promotion, discount } = pickBestPromotion(
      [...activePromotions, ...firstOrderPromotions],
      product,
      unitPrice,
      item.quantity
    );
    const lineTotal = unitPrice * item.quantity;

    subtotal += lineTotal;
    promotionDiscount += discount;
    priced.push({ item, product, variant, unitPrice, lineTotal, promotionShare: discount, promotionId: promotion?.id });
  }

  if (subtotal <= 0) throw ApiError.badRequest("Your cart is empty.");

  const isFreeShippingCoupon = cart.coupon?.type === "free_shipping";
  const totalShippingCost = isFreeShippingCoupon || hasVipFreeShipping ? 0 : Number(shippingMethod.price);

  // Group priced items by the store that owns each product.
  const groups = new Map(); // storeId -> { items: [...], subtotal, promotionDiscount }
  for (const priced_ of priced) {
    const group = groups.get(priced_.product.storeId) || { items: [], subtotal: 0, promotionDiscount: 0 };
    group.items.push(priced_);
    group.subtotal += priced_.lineTotal;
    group.promotionDiscount += priced_.promotionShare;
    groups.set(priced_.product.storeId, group);
  }

  // A store-scoped coupon only discounts that one store's group; a platform-wide coupon's total
  // discount (computed once, correctly, against its eligible subtotal) is split proportionally.
  let totalCouponDiscount = 0;
  if (cart.coupon) {
    const eligibleSubtotal = cart.coupon.storeId
      ? groups.get(cart.coupon.storeId)?.subtotal || 0
      : subtotal - promotionDiscount;
    totalCouponDiscount = calculateTotals({ subtotal: eligibleSubtotal, promotionDiscount: 0, coupon: cart.coupon, shippingCost: 0, settings }).discount;
  }

  const orders = await prisma.$transaction(async (tx) => {
    const created = [];

    for (const [storeId, group] of groups.entries()) {
      const share = group.subtotal / subtotal;
      const groupCouponDiscount = cart.coupon?.storeId
        ? storeId === cart.coupon.storeId
          ? totalCouponDiscount
          : 0
        : Math.round(totalCouponDiscount * share * 100) / 100;

      const groupTotals = calculateTotals({
        subtotal: group.subtotal,
        promotionDiscount: group.promotionDiscount,
        coupon: cart.coupon,
        discountOverride: groupCouponDiscount,
        shippingCost: totalShippingCost * share,
        codCharge: codCharge * share,
        settings,
      });

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          storeId,
          subtotal: groupTotals.subtotal,
          discount: Math.round((groupTotals.discount + group.promotionDiscount) * 100) / 100,
          shippingCost: groupTotals.shippingCost,
          tax: groupTotals.tax,
          platformFee: groupTotals.platformFee,
          codCharge: groupTotals.codCharge,
          total: groupTotals.total,
          couponId: cart.coupon?.id || null,
          shippingAddressId,
          shippingMethodId,
          paymentMethod,
          status: "pending",
          paymentStatus: "pending",
          items: {
            create: group.items.map(({ item, product, variant, unitPrice }) => ({
              productId: product.id,
              variantId: variant?.id || null,
              nameSnapshot: product.name,
              variantSnapshot: item.variantSnapshot,
              priceSnapshot: unitPrice,
              quantity: item.quantity,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      for (const { item, product, variant } of group.items) {
        // Fulfilled from the owning store's own stock — the only fulfillment source that exists
        // today (see fulfillment.service.js for the seam a future warehouse source plugs into).
        await fulfillmentService.fulfillOrderItem(tx, {
          source: "seller_stock",
          productId: product.id,
          variantId: variant?.id,
          quantity: item.quantity,
          productName: product.name,
          actorId: userId,
          orderId: order.id,
        });
      }

      created.push(order);
    }

    if (cart.coupon) {
      await tx.coupon.update({ where: { id: cart.coupon.id }, data: { usageCount: { increment: 1 } } });
      await tx.couponRedemption.create({
        data: { couponId: cart.coupon.id, userId, orderId: created[0]?.id },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } });

    await tx.activityLog.create({
      data: {
        actorId: userId,
        action: `Placed order${created.length > 1 ? "s" : ""} ${created.map((o) => o.orderNumber).join(", ")}`,
        scope: "orders",
        entityType: "Order",
        entityId: created[0].id,
      },
    });

    return created;
  });

  // Low-stock check + notification happens outside the transaction (best-effort, non-blocking for the purchase).
  await checkLowStockAndNotify(priced.map((p) => p.product.id));

  await notificationsService.create(userId, {
    title: "Order placed",
    body: `Your order${orders.length > 1 ? "s" : ""} ${orders.map((o) => o.orderNumber).join(", ")} ${
      orders.length > 1 ? "have" : "has"
    } been placed.`,
  });

  return orders.map(toPlain);
}

async function checkLowStockAndNotify(productIds) {
  const products = await prisma.product.findMany({ where: { id: { in: [...new Set(productIds)] } } });
  const lowStockProducts = products.filter((p) => p.stock <= p.lowStockThreshold);
  if (lowStockProducts.length === 0) return;

  const stores = await prisma.store.findMany({ where: { id: { in: [...new Set(lowStockProducts.map((p) => p.storeId))] } } });
  const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));

  for (const product of lowStockProducts) {
    const store = storeById[product.storeId];
    if (store) {
      await notificationsService.create(store.ownerId, {
        title: product.stock === 0 ? "Out of stock" : "Low stock alert",
        body: `"${product.name}" ${product.stock === 0 ? "is now out of stock" : `has only ${product.stock} left`}.`,
      });
    }
  }
}

async function listForUser(userId, query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 10 });
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where: { userId }, include: ORDER_INCLUDE, orderBy: { placedAt: "desc" }, skip, take }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { items: items.map(toPlain), page, limit, total };
}

async function getByIdForUser(userId, id) {
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order || order.userId !== userId) throw ApiError.notFound("Order not found.");
  return toPlain(order);
}

async function getByIdRaw(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: { ...ORDER_INCLUDE, user: true } });
  if (!order) throw ApiError.notFound("Order not found.");
  return order;
}

/** Used by admin (any order) and seller (only their own store's orders) controllers. */
async function updateStatus(id, data, { storeId, isAdmin, actorId, ipAddress }) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw ApiError.notFound("Order not found.");
  if (!isAdmin && order.storeId !== storeId) throw ApiError.forbidden("This order does not belong to your store.");

  // Once any item on this order has been fulfilled from the Veluntra warehouse, the seller never
  // physically had the parcel — only admin (acting as warehouse ops) can advance shipping status
  // or touch tracking for it. A purely seller-fulfilled order is completely unaffected.
  const hasWarehouseItem = order.items.some((i) => i.fulfillmentSource === "veluntra_warehouse");
  const touchesShipping =
    data.status === "shipped" || data.trackingCarrier !== undefined || data.trackingNumber !== undefined || data.trackingUrl !== undefined;
  if (!isAdmin && hasWarehouseItem && touchesShipping) {
    throw ApiError.forbidden("This order was fulfilled from the Veluntra warehouse — only admin can update its shipping status or tracking.");
  }

  const isRestocking = Boolean(data.status && isRestockingTransition(order.status, data.status));
  const finalData = { ...data };
  if (isRestocking && data.status === "cancelled" && order.paymentStatus === "paid" && !data.paymentStatus) {
    finalData.paymentStatus = "refunded";
    finalData.refundAmount = order.total;
  }
  if (data.status === "delivered" && order.status !== "delivered") finalData.deliveredAt = new Date();
  if (data.status === "cancelled" && order.status !== "cancelled") finalData.cancelledAt = new Date();

  // Tracking fields are routed through the shipment-provider seam instead of being set as raw
  // pass-through data — today the only provider is "manual" (admin/seller-entered fields, passed
  // straight back through), but this is where a real carrier integration plugs in later.
  if (data.trackingCarrier !== undefined || data.trackingNumber !== undefined || data.trackingUrl !== undefined) {
    const trackingUpdate = await resolveShipmentProvider(order).updateTracking(order, {
      trackingCarrier: data.trackingCarrier,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    });
    Object.assign(finalData, trackingUpdate);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({ where: { id }, data: finalData, include: ORDER_INCLUDE });

    // Inventory automation: restock when an order is cancelled, returned, or exchanged.
    if (isRestocking) {
      const type = restockTypeFor(data.status);
      for (const item of order.items) {
        await inventoryService.restoreStock(tx, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          type,
          actorId,
          orderId: id,
        });
      }
    }

    // Reward points, at the admin-configured rate, awarded on delivery (unless the program is disabled).
    if (data.status === "delivered" && order.status !== "delivered") {
      const settings = await settingsService.getOrCreate();
      if (settingsService.resolveFeatureFlags(settings).loyaltyPoints) {
        const points = Math.floor(Number(order.total) * Number(settings.loyaltyPointsPerUnit));
        if (points > 0) {
          await tx.user.update({ where: { id: order.userId }, data: { rewardPoints: { increment: points } } });
        }
      }

      // VIP tier: lifetime spend accrues on delivery (same trust point as reward points —
      // an order only counts once it's actually been fulfilled), then re-evaluate the
      // customer's tier against the current thresholds. Silver/Gold/Platinum, highest wins.
      const vipTiers = settingsService.resolveVipTiers(settings);
      const buyer = await tx.user.update({
        where: { id: order.userId },
        data: { lifetimeSpend: { increment: order.total } },
      });
      const nextTier = settingsService.resolveTierForSpend(vipTiers, buyer.lifetimeSpend);
      if (nextTier !== buyer.vipTier) {
        await tx.user.update({ where: { id: order.userId }, data: { vipTier: nextTier } });
      }
    }

    return next;
  });

  if (data.status && data.status !== order.status) {
    const settings = await settingsService.getOrCreate();
    const notifyMap = settings.orderStatusNotify || {};
    if (notifyMap[data.status] !== false) {
      await notificationsService.create(order.userId, {
        title: "Order update",
        body: `Order ${order.orderNumber} is now ${data.status.replace(/_/g, " ")}.`,
      });
    }
  }

  if (data.paymentStatus === "paid" && order.paymentStatus !== "paid") {
    await notificationsService.create(order.userId, {
      title: "Payment received",
      body: `We've received payment of £${Number(order.total).toFixed(2)} for order ${order.orderNumber}.`,
    });
    const store = await prisma.store.findUnique({ where: { id: order.storeId } });
    if (store) {
      await notificationsService.create(store.ownerId, {
        title: "Payment received",
        body: `Payment received for order ${order.orderNumber} (£${Number(order.total).toFixed(2)}).`,
      });
    }
  }

  await logActivity({
    actorId,
    action: `Updated order ${order.orderNumber}`,
    scope: "orders",
    entityType: "Order",
    entityId: id,
    previousValue: { status: order.status, paymentStatus: order.paymentStatus },
    newValue: { status: updated.status, paymentStatus: updated.paymentStatus },
    ipAddress,
  });

  return toPlain(updated);
}

/** Customer self-service cancellation — only within the admin-configured cancellation window. */
async function requestCancellation(userId, orderId, { reason, ipAddress }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw ApiError.notFound("Order not found.");
  if (!isCancellableByCustomer(order.status)) {
    throw ApiError.badRequest("This order can no longer be cancelled.");
  }
  const settings = await settingsService.getOrCreate();
  const windowMs = Number(settings.cancellationWindowHours) * 60 * 60 * 1000;
  if (Date.now() - order.placedAt.getTime() > windowMs) {
    throw ApiError.badRequest(`The cancellation window (${settings.cancellationWindowHours}h after placing the order) has expired.`);
  }
  return updateStatus(orderId, { status: "cancelled", returnReason: reason }, { isAdmin: true, actorId: userId, ipAddress });
}

/** Customer self-service return request — admin/seller later approves (-> returned) or rejects (-> delivered). */
async function requestReturn(userId, orderId, { reason, ipAddress }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw ApiError.notFound("Order not found.");
  if (order.status !== "delivered") throw ApiError.badRequest("Only delivered orders can be returned.");
  const settings = await settingsService.getOrCreate();
  const windowMs = Number(settings.returnWindowDays) * 24 * 60 * 60 * 1000;
  const deliveredAt = order.deliveredAt || order.placedAt;
  if (Date.now() - deliveredAt.getTime() > windowMs) {
    throw ApiError.badRequest(`The return window (${settings.returnWindowDays} days after delivery) has expired.`);
  }
  return updateStatus(orderId, { status: "return_requested", returnReason: reason }, { isAdmin: true, actorId: userId, ipAddress });
}

/** Customer self-service exchange request — admin/seller later approves (-> exchanged) or rejects (-> delivered). */
async function requestExchange(userId, orderId, { reason, ipAddress }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw ApiError.notFound("Order not found.");
  if (order.status !== "delivered") throw ApiError.badRequest("Only delivered orders can be exchanged.");
  const settings = await settingsService.getOrCreate();
  const windowMs = Number(settings.exchangeWindowDays) * 24 * 60 * 60 * 1000;
  const deliveredAt = order.deliveredAt || order.placedAt;
  if (Date.now() - deliveredAt.getTime() > windowMs) {
    throw ApiError.badRequest(`The exchange window (${settings.exchangeWindowDays} days after delivery) has expired.`);
  }
  return updateStatus(orderId, { status: "exchange_requested", returnReason: reason }, { isAdmin: true, actorId: userId, ipAddress });
}

/** Called only from the Stripe webhook (already signature-verified there, so this is trusted —
 * never expose a route that lets a regular request mark an order paid directly). Idempotent:
 * Stripe may deliver the same webhook more than once, and an order already marked paid is
 * simply left alone rather than double-processed. */
async function markPaid(orderIds) {
  for (const id of orderIds) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order || order.paymentStatus === "paid") continue;

    await prisma.order.update({ where: { id }, data: { paymentStatus: "paid" } });
    await logActivity({
      actorId: order.userId,
      action: `Payment received for order ${order.orderNumber}`,
      scope: "orders",
      entityType: "Order",
      entityId: order.id,
      previousValue: { paymentStatus: order.paymentStatus },
      newValue: { paymentStatus: "paid" },
    });
    await notificationsService.create(order.userId, {
      title: "Payment received",
      body: `Your payment for order ${order.orderNumber} was successful.`,
    });
  }
}

module.exports = {
  createFromCart,
  listForUser,
  getByIdForUser,
  getByIdRaw,
  updateStatus,
  requestCancellation,
  requestReturn,
  requestExchange,
  markPaid,
  ORDER_INCLUDE,
};
