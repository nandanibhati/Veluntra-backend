const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const couponsService = require("../coupons/coupons.service");
const promotionsService = require("../promotions/promotions.service");
const { pickBestPromotion } = require("../../utils/pricing");

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      },
      variant: true,
    },
  },
  coupon: true,
};

async function getOrCreateCart({ userId, sessionId }) {
  const where = userId ? { userId } : { sessionId };
  let cart = await prisma.cart.findFirst({ where, include: CART_INCLUDE });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId, sessionId }, include: CART_INCLUDE });
  }
  return cart;
}

async function summarize(cart) {
  const activePromotions = await promotionsService.listActive();

  const items = cart.items.map((item) => {
    const unitPrice = Number(item.variant?.price ?? item.priceSnapshot);
    const { promotion, discount } = pickBestPromotion(activePromotions, item.product, unitPrice, item.quantity);
    const lineOriginal = Math.round(unitPrice * item.quantity * 100) / 100;
    const lineTotal = Math.round((lineOriginal - discount) * 100) / 100;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.product.name,
      image: item.variant?.imageUrl || item.product.images[0]?.url || null,
      variant: item.variantSnapshot,
      quantity: item.quantity,
      price: unitPrice,
      promotion: promotion ? { id: promotion.id, name: promotion.name, type: promotion.type } : null,
      promotionDiscount: discount,
      lineOriginal,
      lineTotal,
    };
  });

  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineOriginal, 0) * 100) / 100;
  const promotionDiscount = Math.round(items.reduce((sum, i) => sum + i.promotionDiscount, 0) * 100) / 100;

  // A store-scoped coupon only discounts that store's share of the cart (relevant once >1 store exists).
  let couponDiscountAmount = 0;
  if (cart.coupon) {
    const eligibleSubtotal = cart.coupon.storeId
      ? Math.round(
          cart.items
            .filter((i) => i.product.storeId === cart.coupon.storeId)
            .reduce((sum, i) => sum + Number(i.priceSnapshot) * i.quantity, 0) * 100
        ) / 100
      : subtotal - promotionDiscount;
    couponDiscountAmount = couponsService.computeDiscount(cart.coupon, eligibleSubtotal);
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return toPlain({
    id: cart.id,
    items,
    itemCount,
    subtotal,
    promotionDiscount,
    discount: couponDiscountAmount,
    coupon: cart.coupon
      ? { code: cart.coupon.code, type: cart.coupon.type, value: cart.coupon.value, storeId: cart.coupon.storeId }
      : null,
  });
}

async function getCart(identity) {
  const cart = await getOrCreateCart(identity);
  return summarize(cart);
}

async function addItem(identity, { productId, quantity, variant }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound("Product not found.");

  let variantRecord = null;
  if (variant && Object.keys(variant).length > 0) {
    const variants = await prisma.productVariant.findMany({ where: { productId } });
    variantRecord = variants.find((v) => JSON.stringify(v.combination) === JSON.stringify(variant)) || null;
  }

  const availableStock = variantRecord ? variantRecord.stock : product.stock;
  if (availableStock < quantity) throw ApiError.badRequest("Not enough stock available.");

  const cart = await getOrCreateCart(identity);

  const existing = cart.items.find(
    (i) =>
      i.productId === productId &&
      (variantRecord ? i.variantId === variantRecord.id : JSON.stringify(i.variantSnapshot || {}) === JSON.stringify(variant || {}))
  );

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantRecord?.id || null,
        quantity,
        variantSnapshot: variant || null,
        priceSnapshot: variantRecord?.price ?? product.price,
      },
    });
  }

  return getCart(identity);
}

async function updateItem(identity, itemId, { quantity }) {
  const cart = await getOrCreateCart(identity);
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw ApiError.notFound("Cart item not found.");
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return getCart(identity);
}

async function removeItem(identity, itemId) {
  const cart = await getOrCreateCart(identity);
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw ApiError.notFound("Cart item not found.");
  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCart(identity);
}

async function applyCoupon(identity, code) {
  const cart = await getOrCreateCart(identity);
  const coupon = await couponsService.findValidCoupon(code, identity.userId);

  const { subtotal, promotionDiscount } = await summarize(cart);
  const eligibleSubtotal = coupon.storeId
    ? Math.round(
        cart.items
          .filter((i) => i.product.storeId === coupon.storeId)
          .reduce((sum, i) => sum + Number(i.priceSnapshot) * i.quantity, 0) * 100
      ) / 100
    : subtotal - promotionDiscount;

  if (coupon.minSubtotal && Number(coupon.minSubtotal) > eligibleSubtotal) {
    throw ApiError.badRequest(`This code requires a subtotal of £${Number(coupon.minSubtotal)}+.`);
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
  return getCart(identity);
}

async function removeCoupon(identity) {
  const cart = await getOrCreateCart(identity);
  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
  return getCart(identity);
}

/** Called right after login: folds a guest session cart into the user's cart. */
async function mergeGuestCart(userId, sessionId) {
  if (!sessionId) return;
  const guestCart = await prisma.cart.findFirst({ where: { sessionId }, include: { items: true } });
  if (!guestCart || guestCart.items.length === 0) return;

  // getOrCreateCart already loads the user's existing items, so we can match against them
  // in memory instead of querying once per guest-cart line item.
  const userCart = await getOrCreateCart({ userId });
  const existingByKey = new Map(userCart.items.map((i) => [`${i.productId}:${i.variantId || ""}`, i]));

  for (const item of guestCart.items) {
    const existing = existingByKey.get(`${item.productId}:${item.variantId || ""}`);
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          variantSnapshot: item.variantSnapshot,
          priceSnapshot: item.priceSnapshot,
        },
      });
    }
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
}

module.exports = {
  getOrCreateCart,
  getCart,
  addItem,
  updateItem,
  removeItem,
  applyCoupon,
  removeCoupon,
  mergeGuestCart,
  summarize,
};
