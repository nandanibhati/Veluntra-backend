const ApiError = require("../../utils/ApiError");
const prisma = require("../../config/db");

/**
 * The Veluntra warehouse's own stock pool — deliberately a parallel module to
 * inventory.service.js rather than a generalized version of it: the two pools have genuinely
 * different owning models (Product/ProductVariant.stock + InventoryTransaction here vs.
 * WarehouseStock + WarehouseStockTransaction), and forcing inventory.service.js's existing
 * call sites (checkout, cancel/return/exchange restock) to thread a "target" parameter through
 * for zero benefit isn't worth the blast radius. Same atomic-conditional-UPDATE + audit-log
 * pattern, mirrored here.
 */

/** Finds the WarehouseStock row for a product/variant, or creates one at stock:0 if it doesn't
 * exist yet — nothing is fulfillable until an admin explicitly provisions it, but the row itself
 * can be created lazily the first time anyone (admin provisioning, a fulfillment attempt) needs
 * to reference it. Must be called inside an open transaction (`tx`) to avoid a race between two
 * concurrent callers both trying to create the same row. */
async function getOrCreate(tx, { productId, variantId = null }) {
  const existing = await tx.warehouseStock.findFirst({ where: { productId, variantId } });
  if (existing) return existing;
  return tx.warehouseStock.create({ data: { productId, variantId, stock: 0 } });
}

async function logChange(tx, { productId, variantId, type, quantityBefore, quantityAfter, reason = null, actorId = null, orderId = null }) {
  if (quantityBefore === quantityAfter) return null;
  return tx.warehouseStockTransaction.create({
    data: { productId, variantId, type, quantityBefore, quantityAfter, delta: quantityAfter - quantityBefore, reason, actorId, orderId },
  });
}

/** Admin top-up — always increases stock (a negative quantity doesn't make sense for
 * "provisioning"; use adjust() for corrections that can go either way). */
async function provision(tx, { productId, variantId = null, quantity, actorId = null, reason = null }) {
  if (quantity <= 0) throw ApiError.badRequest("Provision quantity must be positive.");
  const row = await getOrCreate(tx, { productId, variantId });
  const quantityAfter = row.stock + quantity;
  await tx.warehouseStock.update({ where: { id: row.id }, data: { stock: quantityAfter } });
  await logChange(tx, { productId, variantId, type: "admin_provision", quantityBefore: row.stock, quantityAfter, actorId, reason });
  return quantityAfter;
}

/** Admin correction — a signed delta (positive or negative), for damage/miscount/recount, unlike
 * provision() which only ever increases stock. */
async function adjust(tx, { productId, variantId = null, delta, actorId = null, reason = null }) {
  const row = await getOrCreate(tx, { productId, variantId });
  const quantityAfter = row.stock + delta;
  if (quantityAfter < 0) throw ApiError.badRequest("Adjustment would take warehouse stock below zero.");
  await tx.warehouseStock.update({ where: { id: row.id }, data: { stock: quantityAfter } });
  await logChange(tx, { productId, variantId, type: "admin_adjustment", quantityBefore: row.stock, quantityAfter, actorId, reason });
  return quantityAfter;
}

/** Atomic, conditional decrement — same overselling guard as inventory.service.js's
 * decrementStock: the WHERE clause's stock check is evaluated by Postgres at UPDATE time under
 * row-level lock. If no WarehouseStock row exists at all for this product/variant, that's
 * equivalent to zero stock — nothing provisioned, nothing fulfillable. */
async function decrementStock(tx, { productId, variantId = null, quantity, actorId = null, orderId = null, notEnoughStockMessage }) {
  const row = await tx.warehouseStock.findFirst({ where: { productId, variantId } });
  if (!row) {
    throw ApiError.badRequest(notEnoughStockMessage || "Not enough warehouse stock provisioned for this product.");
  }
  const result = await tx.warehouseStock.updateMany({
    where: { id: row.id, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (result.count === 0) {
    throw ApiError.badRequest(notEnoughStockMessage || "Not enough warehouse stock provisioned for this product.");
  }
  const updated = await tx.warehouseStock.findUnique({ where: { id: row.id }, select: { stock: true } });
  await logChange(tx, { productId, variantId, type: "fulfillment_deduct", quantityBefore: updated.stock + quantity, quantityAfter: updated.stock, actorId, orderId });
  return updated.stock;
}

/** Restores warehouse stock (e.g. a warehouse-fulfilled order later gets cancelled/returned). */
async function restoreStock(tx, { productId, variantId = null, quantity, actorId = null, orderId = null }) {
  const row = await tx.warehouseStock.findFirst({ where: { productId, variantId } });
  if (!row) return null;
  const quantityAfter = row.stock + quantity;
  await tx.warehouseStock.update({ where: { id: row.id }, data: { stock: quantityAfter } });
  await logChange(tx, { productId, variantId, type: "fulfillment_restore", quantityBefore: row.stock, quantityAfter, actorId, orderId });
  return quantityAfter;
}

/** Admin listing — current stock per product/variant plus recent transactions, for the
 * Warehouse Stock admin screen. */
async function list(query) {
  const where = {};
  if (query.search) {
    where.product = { name: { contains: query.search, mode: "insensitive" } };
  }
  const rows = await prisma.warehouseStock.findMany({
    where,
    include: { product: { select: { id: true, name: true, sku: true } }, variant: { select: { id: true, sku: true, combination: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows;
}

async function transactionsFor(productId, variantId) {
  return prisma.warehouseStockTransaction.findMany({
    where: { productId, variantId: variantId || null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

module.exports = { getOrCreate, provision, adjust, decrementStock, restoreStock, list, transactionsFor };
