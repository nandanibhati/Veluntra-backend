/** Restores the 71 products that were mistakenly deleted by cleanupDemoProductsByBrand.js —
 * they were filed under placeholder demo brand names but were actually real accessory
 * inventory uploaded on 2026-07-22, not throwaway demo data. Recreates them with their
 * original id/slug/sku/timestamps plus any images/options/variants, from a pre-deletion
 * backup snapshot restored into a local Postgres copy.
 *
 * Usage: node scripts/restoreJuly22Products.js <path-to-exported-json>
 */
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) throw new Error("Usage: node scripts/restoreJuly22Products.js <path-to-json>");
  const products = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Restoring ${products.length} products`);

  let restored = 0;
  for (const p of products) {
    const { images, options, variants, ...productData } = p;
    await prisma.product.create({
      data: {
        ...productData,
        images: images.length ? { create: images.map(({ id, productId, ...img }) => img) } : undefined,
        options: options.length ? { create: options.map(({ id, productId, ...opt }) => opt) } : undefined,
        variants: variants.length ? { create: variants.map(({ id, productId, ...v }) => v) } : undefined,
      },
    });
    restored++;
  }

  console.log(`Done. Restored ${restored} products.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
