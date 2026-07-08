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
const { seedSampleCatalog, backfillCatalogImages } = require("./seedCatalog");

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
  // Runs automatically, exactly once: only when there are zero products in the database.
  // Every category, brand, and product is fully editable/replaceable from the Admin/Seller
  // dashboard afterwards — this is a starting catalog, not real inventory.
  const productCount = await prisma.product.count();
  if (productCount === 0) {
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
      console.log(
        `  Starter catalog: ${result.categoriesCreated} categories, ${result.brandsCreated} brands, ${result.productsCreated} products created.`
      );
    }
  } else {
    // The starter catalog already exists (seedSampleCatalog only ever runs once, above) — but a
    // row created on an earlier boot can still be missing a photo if it was created before a
    // photo feature existed. Unlike seedSampleCatalog, this runs on every boot so a fix like
    // that reaches production the moment it deploys, not only on a from-scratch database.
    const backfill = await backfillCatalogImages(prisma);
    if (backfill.categoriesBackfilled || backfill.productsBackfilled) {
      console.log(
        `  Backfilled photos: ${backfill.categoriesBackfilled} categories, ${backfill.productsBackfilled} products.`
      );
    }
    if (backfill.categoriesUpgraded || backfill.productsUpgraded) {
      console.log(
        `  Upgraded photos: ${backfill.categoriesUpgraded} categories, ${backfill.productsUpgraded} products (random -> curated).`
      );
    }
  }

  console.log("Production bootstrap complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
