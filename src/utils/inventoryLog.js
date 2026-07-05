const prisma = require("../config/db");

/**
 * Records a stock change for the inventory history audit trail. Pass `tx` when the
 * caller already has an open Prisma transaction so the log entry can never disagree
 * with the stock mutation it's describing (both commit or both roll back together).
 */
async function logInventoryChange(
  { productId, variantId = null, type, quantityBefore, quantityAfter, reason = null, actorId = null, orderId = null },
  tx = prisma
) {
  if (quantityBefore === quantityAfter) return null; // no-op change, nothing to record
  return tx.inventoryTransaction.create({
    data: {
      productId,
      variantId,
      type,
      quantityBefore,
      quantityAfter,
      delta: quantityAfter - quantityBefore,
      reason,
      actorId,
      orderId,
    },
  });
}

module.exports = { logInventoryChange };
