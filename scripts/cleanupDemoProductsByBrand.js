/** Retires placeholder demo products, scoped to a specific list of fictional demo brand names
 * (not "every product with no orders" — a live store's real, order-less products must survive
 * this). Products with real order/review history get archived (kept, hidden from storefront);
 * everything else under those brands gets hard-deleted since nothing references it.
 *
 * Usage: node scripts/cleanupDemoProductsByBrand.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEMO_BRAND_NAMES = [
  "Veluntra", "Aurelia", "Nordline", "Vespera", "Kodex",
  "Meridian", "Nexora", "Orbital", "Lumen Labs", "Circuit & Co.",
];

async function main() {
  const products = await prisma.product.findMany({
    where: { brand: { name: { in: DEMO_BRAND_NAMES } } },
    select: { id: true, name: true, sku: true },
  });
  console.log(`Found ${products.length} products under demo brands: ${DEMO_BRAND_NAMES.join(", ")}`);
  const ids = products.map((p) => p.id);

  const [orderItems, reviews] = await Promise.all([
    prisma.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true } }),
    prisma.review.findMany({ where: { productId: { in: ids } }, select: { productId: true } }),
  ]);
  const protectedIds = new Set([...orderItems.map((o) => o.productId), ...reviews.map((r) => r.productId)]);

  const toArchive = products.filter((p) => protectedIds.has(p.id));
  const toDelete = products.filter((p) => !protectedIds.has(p.id));

  for (const p of toArchive) {
    await prisma.product.update({ where: { id: p.id }, data: { status: "archived" } });
  }
  console.log(`\nArchived ${toArchive.length} products with order/review history:`);
  toArchive.forEach((p) => console.log(`  - ${p.name} (${p.sku})`));

  for (const p of toDelete) {
    await prisma.product.delete({ where: { id: p.id } });
  }
  console.log(`\nDeleted ${toDelete.length} demo products with no history.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
