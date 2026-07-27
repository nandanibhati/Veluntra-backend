const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");

const REQUEST_INCLUDE = {
  product: { select: { id: true, name: true, images: { take: 1, orderBy: { position: "asc" } } } },
  wholesaler: { select: { id: true, name: true, email: true } },
};

/** unitPrice is always computed server-side from the product's current wholesale price (falling
 * back to retail price) — never trusts a client-supplied amount, and snapshots it onto the
 * request so a later price change doesn't rewrite history. */
async function create(wholesalerId, data) {
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product || product.status !== "published") throw ApiError.badRequest("This product isn't available.");

  const unitPrice = product.wholesalePrice != null ? product.wholesalePrice : product.price;

  const request = await prisma.wholesaleOrderRequest.create({
    data: {
      wholesalerId,
      productId: data.productId,
      quantity: data.quantity,
      unitPrice,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      city: data.city,
      country: data.country,
      postalCode: data.postalCode,
      purchaseOrderReference: data.purchaseOrderReference || null,
      specialInstructions: data.specialInstructions || null,
    },
    include: REQUEST_INCLUDE,
  });
  return toPlain(request);
}

/** A wholesaler only ever sees their own requests; admin sees everyone's (scoped via `wholesalerId` being absent). */
async function list(query, { wholesalerId, isAdmin }) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (!isAdmin) where.wholesalerId = wholesalerId;
  if (query.status && query.status !== "all") where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.wholesaleOrderRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.wholesaleOrderRequest.count({ where }),
  ]);
  return { items: items.map(toPlain), page, limit, total };
}

async function setStatus(id, status) {
  const request = await prisma.wholesaleOrderRequest.findUnique({ where: { id } });
  if (!request) throw ApiError.notFound("Order request not found.");
  const updated = await prisma.wholesaleOrderRequest.update({ where: { id }, data: { status }, include: REQUEST_INCLUDE });
  return toPlain(updated);
}

module.exports = { create, list, setStatus };
