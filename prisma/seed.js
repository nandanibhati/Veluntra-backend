/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { seedSampleCatalog } = require("./seedCatalog");

const prisma = new PrismaClient();

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SEED !== "true") {
    console.error(
      "Refusing to run the development seed (demo accounts with known passwords + sample catalogue) " +
        "against a production environment. Use `node prisma/seed.production.js` instead, or set " +
        "ALLOW_DEV_SEED=true if you really mean to seed demo data here."
    );
    process.exit(1);
  }

  console.log("Seeding Veluntra database...");

  // ---------- Settings ----------
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: "Veluntra",
      currency: "GBP",
      currencySymbol: "£",
      taxPercent: 8,
      platformCommissionPercent: 0,
      defaultShippingCost: 0,
      contactEmail: "support@veluntra.example",
      returnPolicy: "30-day hassle-free returns on all unopened or unused items.",
      privacyPolicy: "We respect your privacy and never sell your data.",
      termsOfService: "Standard terms of service apply to all purchases.",
    },
  });

  // ---------- Users ----------
  const adminPassword = await hash("Admin123!");
  const sellerPassword = await hash("Seller123!");
  const customerPassword = await hash("Customer123!");

  const admin = await prisma.user.upsert({
    where: { email: "admin@veluntra.example" },
    update: {},
    create: {
      name: "Veluntra Admin",
      email: "admin@veluntra.example",
      passwordHash: adminPassword,
      role: "admin",
      emailVerifiedAt: new Date(),
    },
  });

  const superadminPassword = await hash("Superadmin123!");
  await prisma.user.upsert({
    where: { email: "owner@veluntra.example" },
    update: {},
    create: {
      name: "Veluntra Owner",
      email: "owner@veluntra.example",
      passwordHash: superadminPassword,
      role: "superadmin",
      emailVerifiedAt: new Date(),
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@veluntra.example" },
    update: {},
    create: {
      name: "Veluntra Seller",
      email: "seller@veluntra.example",
      passwordHash: sellerPassword,
      role: "seller",
      emailVerifiedAt: new Date(),
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@veluntra.example" },
    update: {},
    create: {
      name: "Alex Morgan",
      email: "customer@veluntra.example",
      passwordHash: customerPassword,
      role: "customer",
      emailVerifiedAt: new Date(),
    },
  });

  const store = await prisma.store.upsert({
    where: { ownerId: sellerUser.id },
    update: { status: "approved" },
    create: { name: "Veluntra", ownerId: sellerUser.id, status: "approved" },
  });

  // ---------- Catalog (categories, brands, products, shipping, coupons, promo, homepage) ----------
  const { productsCreated } = await seedSampleCatalog(prisma, { storeId: store.id });

  // ---------- A sample approved review ----------
  const firstProduct = await prisma.product.findFirst({ where: { name: "Aurora Pro Wireless Earbuds" } });
  if (firstProduct) {
    const existingReview = await prisma.review.findFirst({ where: { productId: firstProduct.id, userId: customer.id } });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          productId: firstProduct.id,
          userId: customer.id,
          rating: 5,
          title: "Exceeds every expectation",
          body: "Battery life and sound quality are unlike anything else I've owned. Worth every penny.",
          status: "approved",
          isVerified: true,
        },
      });
      await prisma.product.update({
        where: { id: firstProduct.id },
        data: { ratingAvg: 4.9, ratingCount: { increment: 1 } },
      });
    }
  }

  console.log(`Seed complete. Created ${productsCreated} new products.`);
  console.log("Login credentials:");
  console.log("  Superadmin: owner@veluntra.example / Superadmin123!");
  console.log("  Admin:      admin@veluntra.example / Admin123!");
  console.log("  Seller:     seller@veluntra.example / Seller123!");
  console.log("  Customer:   customer@veluntra.example / Customer123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
