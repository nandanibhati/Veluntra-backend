const prisma = require("../config/db");

/**
 * Resolves "the one store" an Admin/Super Admin implicitly manages when they don't own
 * a store themselves and haven't named one explicitly — used by both the Seller
 * Dashboard and admin product creation without an explicit storeId. While the platform
 * has zero or one store total, this is unambiguous, so:
 *   - zero stores: auto-creates one, owned by the calling admin, pre-approved (they
 *     don't need to approve themselves) — lets an admin start managing products/orders
 *     immediately without a separate seller signup.
 *   - one store: returns it.
 *   - more than one: ambiguous, returns null so the caller can require an explicit choice.
 */
async function resolveSoleStoreForAdmin(userId) {
  const stores = await prisma.store.findMany({ take: 2 });
  if (stores.length > 1) return null;
  if (stores.length === 1) return stores[0];

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return prisma.store.create({
    data: { name: settings?.storeName || "My Store", ownerId: userId, status: "approved" },
  });
}

module.exports = { resolveSoleStoreForAdmin };
