const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const notificationsService = require("../notifications/notifications.service");
const fulfillmentService = require("../fulfillment/fulfillment.service");

const REQUESTABLE_ORDER_STATUSES = new Set(["pending", "processing"]);

/** Seller requests warehouse fulfillment for one of their own order items — a declaration
 * reviewed by admin, not a live stock check (by order-creation time the seller's own stock was
 * already decremented, so a fresh zero-check wouldn't reflect real-world reasons like damage or
 * miscount). Any pending/processing item not already warehouse-fulfilled is eligible. */
async function create(sellerUserId, storeId, { orderId, orderItemId, sellerNote }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.storeId !== storeId) throw ApiError.notFound("Order not found.");
  if (!REQUESTABLE_ORDER_STATUSES.has(order.status)) {
    throw ApiError.badRequest("Warehouse fulfillment can only be requested for pending or processing orders.");
  }

  const item = order.items.find((i) => i.id === orderItemId);
  if (!item) throw ApiError.notFound("Order item not found.");
  if (item.fulfillmentSource !== "seller_stock") {
    throw ApiError.badRequest("This item has already been fulfilled from the Veluntra warehouse.");
  }

  const existingPending = await prisma.fulfillmentRequest.findFirst({ where: { orderItemId, status: "pending" } });
  if (existingPending) throw ApiError.conflict("A fulfillment request for this item is already pending.");

  const request = await prisma.fulfillmentRequest.create({
    data: { orderId, orderItemId, requestedByUserId: sellerUserId, sellerNote },
  });

  const admins = await prisma.user.findMany({ where: { role: { in: ["admin", "superadmin"] } }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      notificationsService.create(a.id, {
        title: "Warehouse fulfillment requested",
        body: `A seller requested warehouse fulfillment for "${item.nameSnapshot}" on order ${order.orderNumber}.`,
      })
    )
  );

  return toPlain(request);
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.status && query.status !== "all") where.status = query.status;

  const [items, total, pendingCount] = await Promise.all([
    prisma.fulfillmentRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        order: { select: { orderNumber: true, storeId: true, store: { select: { name: true } } } },
        orderItem: { select: { nameSnapshot: true, quantity: true, productId: true, variantId: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.fulfillmentRequest.count({ where }),
    prisma.fulfillmentRequest.count({ where: { status: "pending" } }),
  ]);

  return {
    items: items.map((r) =>
      toPlain({
        ...r,
        orderNumber: r.order.orderNumber,
        storeName: r.order.store.name,
        itemName: r.orderItem.nameSnapshot,
        quantity: r.orderItem.quantity,
        requestedByName: r.requestedBy.name,
        requestedByEmail: r.requestedBy.email,
        order: undefined,
        orderItem: undefined,
        requestedBy: undefined,
      })
    ),
    page,
    limit,
    total,
    pendingCount,
  };
}

/** Approves a request: fulfills the item from the Veluntra warehouse (atomic, logged — throws
 * cleanly if not enough warehouse stock is provisioned) and marks it fulfilled in one action.
 * No separate "approved" hand-off step — admin *is* warehouse ops today. */
async function approve(id, { adminId, adminNote }) {
  const request = await prisma.fulfillmentRequest.findUnique({
    where: { id },
    include: { order: true, orderItem: true },
  });
  if (!request) throw ApiError.notFound("Fulfillment request not found.");
  if (request.status !== "pending") throw ApiError.badRequest("This request has already been resolved.");

  const updated = await prisma.$transaction(async (tx) => {
    await fulfillmentService.fulfillOrderItem(tx, {
      source: "veluntra_warehouse",
      productId: request.orderItem.productId,
      variantId: request.orderItem.variantId,
      quantity: request.orderItem.quantity,
      productName: request.orderItem.nameSnapshot,
      actorId: adminId,
      orderId: request.orderId,
    });
    await tx.orderItem.update({ where: { id: request.orderItemId }, data: { fulfillmentSource: "veluntra_warehouse" } });
    return tx.fulfillmentRequest.update({
      where: { id },
      data: { status: "fulfilled", adminNote, resolvedAt: new Date() },
    });
  });

  await notificationsService.create(request.requestedByUserId, {
    title: "Warehouse fulfillment approved",
    body: `Your request for "${request.orderItem.nameSnapshot}" on order ${request.order.orderNumber} was fulfilled from the Veluntra warehouse.`,
  });

  return toPlain(updated);
}

async function reject(id, { adminId, adminNote }) {
  const request = await prisma.fulfillmentRequest.findUnique({ where: { id }, include: { order: true, orderItem: true } });
  if (!request) throw ApiError.notFound("Fulfillment request not found.");
  if (request.status !== "pending") throw ApiError.badRequest("This request has already been resolved.");

  const updated = await prisma.fulfillmentRequest.update({
    where: { id },
    data: { status: "rejected", adminNote, resolvedAt: new Date() },
  });

  await notificationsService.create(request.requestedByUserId, {
    title: "Warehouse fulfillment request rejected",
    body: `Your request for "${request.orderItem.nameSnapshot}" on order ${request.order.orderNumber} was rejected.${adminNote ? ` "${adminNote}"` : ""}`,
  });

  return toPlain(updated);
}

module.exports = { create, list, approve, reject };
