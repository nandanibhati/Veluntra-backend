/* eslint-disable no-console */
/**
 * Production bootstrap — deliberately NOT the same script as prisma/seed.js.
 *
 * The dev seed (seed.js) creates demo accounts with publicly-known passwords and a
 * full catalogue of sample products; none of that belongs in a real deployment.
 * This script only creates what a brand-new production database genuinely needs
 * to function, and nothing else:
 *
 *   - The Settings singleton row (id=1), so the storefront/admin panel has a row to read.
 *   - At least one shipping method, so checkout has something to offer.
 *   - Exactly one Super Admin account, but ONLY if SUPERADMIN_EMAIL and
 *     SUPERADMIN_PASSWORD are provided via the environment — never hardcoded,
 *     and skipped entirely (not defaulted) if they're absent.
 *
 * Safe to run multiple times (every step is idempotent).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { seedSampleCatalog, rehostCuratedImages } = require("./seedCatalog");

const prisma = new PrismaClient();

async function main() {
  console.log("Running production bootstrap...");

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: process.env.STORE_NAME || "My Store",
      currency: process.env.STORE_CURRENCY || "GBP",
      currencySymbol: process.env.STORE_CURRENCY_SYMBOL || "£",
      contactEmail: process.env.STORE_CONTACT_EMAIL || null,
    },
  });
  console.log("  Settings row ready.");

  const defaultShippingMethod = await prisma.shippingMethod.findFirst();
  if (!defaultShippingMethod) {
    await prisma.shippingMethod.create({
      data: { name: "Standard", description: "Standard delivery", price: 0, etaDays: "5-7 business days" },
    });
    console.log("  Created a default \"Standard\" shipping method — add more from the admin panel.");
  }

  const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME } = process.env;
  if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD) {
    const existing = await prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL.toLowerCase() } });
    if (existing) {
      if (existing.role === "superadmin") {
        console.log(`  Super Admin ${SUPERADMIN_EMAIL} already exists — leaving it untouched.`);
      } else {
        // A real account was found under this email (e.g. someone signed up as a customer
        // before the bootstrap ever ran) — honor SUPERADMIN_EMAIL's intent and upgrade its
        // role in place. Never touches the existing password, so it stays whatever the
        // account holder already set.
        await prisma.user.update({ where: { id: existing.id }, data: { role: "superadmin" } });
        console.log(`  Upgraded existing account ${SUPERADMIN_EMAIL} (was "${existing.role}") to Super Admin.`);
      }
    } else {
      if (SUPERADMIN_PASSWORD.length < 12) {
        throw new Error("SUPERADMIN_PASSWORD must be at least 12 characters for a production bootstrap.");
      }
      const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
      await prisma.user.create({
        data: {
          name: SUPERADMIN_NAME || "Super Admin",
          email: SUPERADMIN_EMAIL.toLowerCase(),
          passwordHash,
          role: "superadmin",
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`  Created Super Admin account: ${SUPERADMIN_EMAIL}`);
    }
  } else {
    console.log("  SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping admin account creation.");
    console.log("  Set both env vars and re-run this script to provision your first admin login.");
  }

  // ---- Starter catalog (placeholder content so the storefront isn't empty) ----
  // Runs on EVERY boot, not just when the database is empty — every step inside
  // seedSampleCatalog is individually idempotent (upsert / findFirst-then-create per item),
  // so re-running it only ever creates whatever is still missing: a category/product added to
  // this file after the store already had products, a photo added to a category that didn't
  // have one yet, etc. It must NOT be gated behind "productCount === 0", or any catalog change
  // made after the very first deploy would silently never reach production again. Every
  // category, brand, and product is fully editable/replaceable from the Admin/Seller dashboard
  // afterwards — this is a starting catalog, not real inventory.
  const owner = await prisma.user.findFirst({
    where: { role: { in: ["superadmin", "admin"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) {
    console.log("  Skipping starter catalog — no admin/superadmin account exists yet to own the store.");
  } else {
    let store = await prisma.store.findUnique({ where: { ownerId: owner.id } });
    if (!store) {
      const anyStore = await prisma.store.findFirst();
      store =
        anyStore ||
        (await prisma.store.create({
          data: { name: process.env.STORE_NAME || "My Store", ownerId: owner.id, status: "approved" },
        }));
    }
    const result = await seedSampleCatalog(prisma, { storeId: store.id });
    if (result.categoriesCreated || result.brandsCreated || result.productsCreated) {
      console.log(
        `  Starter catalog: ${result.categoriesCreated} categories, ${result.brandsCreated} brands, ${result.productsCreated} products created.`
      );
    }
    if (result.categoriesBackfilled || result.productsBackfilled) {
      console.log(`  Backfilled photos: ${result.categoriesBackfilled} categories, ${result.productsBackfilled} products.`);
    }
    if (result.categoriesUpgraded || result.productsUpgraded) {
      console.log(`  Upgraded photos: ${result.categoriesUpgraded} categories, ${result.productsUpgraded} products (random -> curated).`);
    }
  }

  // Once Cloudinary is configured (Settings > Image storage), move the curated seed photos off
  // Unsplash's hotlink CDN and onto Cloudinary — a no-op until then. See rehostCuratedImages'
  // own doc comment for why this matters even though the Unsplash URLs work fine via direct
  // fetch/curl testing. Never let this block the server from starting — worst case it retries
  // next boot.
  try {
    const rehost = await rehostCuratedImages(prisma);
    if (rehost.rehosted) {
      console.log(`  Re-hosted ${rehost.rehosted} catalog image(s) from Unsplash to Cloudinary.`);
    }
  } catch (err) {
    console.error("  Skipping image re-host this boot:", err.message);
  }

  console.log("Production bootstrap complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
