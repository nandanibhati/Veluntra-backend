/** One-off: retire the placeholder demo catalog before importing the real Phone Shop CSV.
 * Products with real order/review history get archived (kept, hidden from storefront);
 * everything else gets hard-deleted since nothing references it. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
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
  console.log(`Archived ${toArchive.length} products with order/review history:`);
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
