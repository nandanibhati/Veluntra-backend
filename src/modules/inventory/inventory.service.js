const ApiError = require("../../utils/ApiError");
const { logInventoryChange } = require("../../utils/inventoryLog");

/**
 * Single place stock is actually mutated — every stock-changing code path (checkout,
 * cancellation/return/exchange restocking, and any future warehouse/wholesale flow) goes
 * through here instead of duplicating the atomic-update + audit-log pattern inline. Must be
 * called inside an open Prisma transaction (`tx`).
 */

/** Atomically decrements stock for a product or variant, guarding against overselling via a
 * conditional UPDATE — Postgres evaluates the WHERE clause at UPDATE time under row-level lock,
 * not from a possibly-stale value read earlier in the request, which is what actually prevents
 * two concurrent checkouts for the last unit from both committing. Always logs to
 * InventoryTransaction via logInventoryChange. */
async function decrementStock(tx, { productId, variantId = null, quantity, type = "order_deduct", actorId = null, orderId = null, notEnoughStockMessage }) {
  const model = variantId ? tx.productVariant : tx.product;
  const targetId = variantId || productId;
  const result = await model.updateMany({
    where: { id: targetId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (result.count === 0) {
    throw ApiError.badRequest(notEnoughStockMessage || "Not enough stock available.");
  }
  const updated = await model.findUnique({ where: { id: targetId }, select: { stock: true } });
  await logInventoryChange(
    { productId, variantId, type, quantityBefore: updated.stock + quantity, quantityAfter: updated.stock, actorId, orderId },
    tx
  );
  return updated.stock;
}

/** Restores stock (cancellation/return/exchange), same logging contract as decrementStock.
 * A no-op if the product/variant row no longer exists (e.g. deleted after the order was placed)
 * — there's nothing to restock, and returning null lets the caller skip it silently. */
async function restoreStock(tx, { productId, variantId = null, quantity, type, actorId = null, orderId = null }) {
  const model = variantId ? tx.productVariant : tx.product;
  const targetId = variantId || productId;
  const before = await model.findUnique({ where: { id: targetId }, select: { stock: true } });
  if (!before) return null;
  const quantityAfter = before.stock + quantity;
  await model.update({ where: { id: targetId }, data: { stock: quantityAfter } });
  await logInventoryChange({ productId, variantId, type, quantityBefore: before.stock, quantityAfter, actorId, orderId }, tx);
  return quantityAfter;
}

module.exports = { decrementStock, restoreStock };
