const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");

const REQUEST_INCLUDE = {
  product: { select: { id: true, name: true, images: { take: 1, orderBy: { position: "asc" } } } },
  dropshipper: { select: { id: true, name: true, email: true } },
};

/** unitPrice is always computed server-side from the product's current dropship price (falling
 * back to retail price) — never trusts a client-supplied amount, and snapshots it onto the
 * request so a later price change doesn't rewrite history. */
async function create(dropshipperId, data) {
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product || product.status !== "published") throw ApiError.badRequest("This product isn't available.");

  const unitPrice = product.dropshipPrice != null ? product.dropshipPrice : product.price;

  const request = await prisma.dropshipOrderRequest.create({
    data: {
      dropshipperId,
      productId: data.productId,
      quantity: data.quantity,
      unitPrice,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      city: data.city,
      country: data.country,
      postalCode: data.postalCode,
      shippingService: data.shippingService || null,
      customerReference: data.customerReference || null,
      specialInstructions: data.specialInstructions || null,
    },
    include: REQUEST_INCLUDE,
  });
  return toPlain(request);
}

/** A dropshipper only ever sees their own requests; admin sees everyone's (scoped via `dropshipperId` being absent). */
async function list(query, { dropshipperId, isAdmin }) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (!isAdmin) where.dropshipperId = dropshipperId;
  if (query.status && query.status !== "all") where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.dropshipOrderRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.dropshipOrderRequest.count({ where }),
  ]);
  return { items: items.map(toPlain), page, limit, total };
}

async function setStatus(id, status) {
  const request = await prisma.dropshipOrderRequest.findUnique({ where: { id } });
  if (!request) throw ApiError.notFound("Order request not found.");
  const updated = await prisma.dropshipOrderRequest.update({ where: { id }, data: { status }, include: REQUEST_INCLUDE });
  return toPlain(updated);
}

module.exports = { create, list, setStatus };
