/** One-off: removes the starter-catalog products that seedSampleCatalog resurrected on a
 * production boot before the existingProductCount > 60 gate (see prisma/seedCatalog.js) was
 * added — these are placeholder demo items (Aurora Pro Wireless Earbuds, Onyx 14" Ultrabook,
 * etc.), matched by exact name against the fixed PRODUCTS starter list, not real inventory.
 * Skips anything that's somehow picked up order/review history since being recreated. */
const { PrismaClient } = require("@prisma/client");
const { PRODUCTS } = require("../prisma/seedCatalog");
const prisma = new PrismaClient();

async function main() {
  const names = PRODUCTS.map((p) => p.name);
  const products = await prisma.product.findMany({ where: { name: { in: names } }, select: { id: true, name: true, sku: true } });
  console.log(`Found ${products.length} zombie starter-catalog products`);

  const ids = products.map((p) => p.id);
  const [orderItems, reviews] = await Promise.all([
    prisma.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true } }),
    prisma.review.findMany({ where: { productId: { in: ids } }, select: { productId: true } }),
  ]);
  const protectedIds = new Set([...orderItems.map((o) => o.productId), ...reviews.map((r) => r.productId)]);

  const toKeep = products.filter((p) => protectedIds.has(p.id));
  const toDelete = products.filter((p) => !protectedIds.has(p.id));

  if (toKeep.length) {
    console.log(`Leaving ${toKeep.length} alone (picked up order/review history since being recreated):`);
    toKeep.forEach((p) => console.log(`  - ${p.name} (${p.sku})`));
  }

  for (const p of toDelete) {
    await prisma.product.delete({ where: { id: p.id } });
  }
  console.log(`Deleted ${toDelete.length} zombie starter-catalog products.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
