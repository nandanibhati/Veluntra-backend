/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATEGORIES = [
  "Audio",
  "Wearables",
  "Computing",
  "Mobile & Tablets",
  "Smart Home",
  "Home & Kitchen",
  "Personal Care",
  "Kids & Baby",
];

const BRANDS = ["Veluntra", "Aurelia", "Nordline", "Vespera", "Kodex", "Meridian", "Nexora", "Orbital", "Lumen Labs", "Circuit & Co."];

const PRODUCTS = [
  { name: "Aurora Pro Wireless Earbuds", category: "Audio", brand: "Veluntra", price: 178, oldPrice: 220, stock: 60, rating: 4.9, isNew: true },
  { name: "Zenith Noise-Cancel Headphones", category: "Audio", brand: "Circuit & Co.", price: 349, oldPrice: 420, stock: 42, rating: 4.8 },
  { name: "Halo Portable Bluetooth Speaker", category: "Audio", brand: "Veluntra", price: 96, stock: 55, rating: 4.7 },
  { name: "Ember Bluetooth Mini Speaker", category: "Audio", brand: "Nordline", price: 58, stock: 70, rating: 4.6 },
  {
    name: "Nova Titanium Smartwatch",
    category: "Wearables",
    brand: "Nexora",
    price: 890,
    oldPrice: 1050,
    stock: 3,
    rating: 5.0,
    options: [
      { kind: "color", label: "Titanium" },
      { kind: "color", label: "Midnight Black" },
      { kind: "size", label: "40mm" },
      { kind: "size", label: "44mm" },
    ],
    variants: [
      { combination: { size: "40mm" }, stock: 5 },
      { combination: { size: "44mm" }, stock: 3 },
    ],
  },
  { name: "Halo Smart Fitness Ring", category: "Wearables", brand: "Nexora", price: 199, stock: 40, rating: 4.9 },
  { name: "Minimalist Fitness Watch", category: "Wearables", brand: "Meridian", price: 130, stock: 45, rating: 4.8 },
  { name: "Meridian Mechanical Keyboard", category: "Computing", brand: "Meridian", price: 145, stock: 0, rating: 4.8 },
  { name: "Onyx 14\" Ultrabook", category: "Computing", brand: "Veluntra", price: 1340, stock: 24, rating: 4.7, isNew: true },
  { name: "Atlas Mechanical Mouse", category: "Computing", brand: "Nordline", price: 55, stock: 80, rating: 4.7 },
  { name: "Ridge Laptop Backpack", category: "Computing", brand: "Circuit & Co.", price: 89, stock: 65, rating: 4.6 },
  { name: "Lumen Smart Desk Lamp", category: "Smart Home", brand: "Nordline", price: 65, oldPrice: 90, stock: 3, rating: 4.6 },
  { name: "Quartz Smart Table Lamp", category: "Smart Home", brand: "Veluntra", price: 150, oldPrice: 200, stock: 30, rating: 4.5 },
  { name: "Sable Smart Thermostat", category: "Smart Home", brand: "Orbital", price: 89, oldPrice: 149, stock: 38, rating: 4.4 },
  { name: "Nimbus Smart Air Purifier", category: "Smart Home", brand: "Circuit & Co.", price: 165, stock: 22, rating: 4.8, isNew: true },
  { name: "Terra Ceramic Cookware Set", category: "Home & Kitchen", brand: "Veluntra", price: 210, stock: 18, rating: 4.9 },
  { name: "Marble Ceramic Mug Set", category: "Home & Kitchen", brand: "Nordline", price: 40, oldPrice: 80, stock: 90, rating: 4.6 },
  { name: "Everyday Insulated Water Bottle", category: "Home & Kitchen", brand: "Meridian", price: 28, stock: 120, rating: 4.8 },
  { name: "Glacier Cordless Handheld Vacuum", category: "Home & Kitchen", brand: "Orbital", price: 120, stock: 26, rating: 4.8 },
  { name: "Drift Fast Wireless Charging Pad", category: "Mobile & Tablets", brand: "Veluntra", price: 45, stock: 100, rating: 4.7 },
  { name: "Cobalt Portable SSD 1TB", category: "Mobile & Tablets", brand: "Circuit & Co.", price: 130, oldPrice: 200, stock: 50, rating: 4.6 },
  { name: "Essential USB-C Hub", category: "Mobile & Tablets", brand: "Nexora", price: 29, stock: 140, rating: 4.8, isNew: true },
  { name: "Vertex Smart Audio Glasses", category: "Mobile & Tablets", brand: "Meridian", price: 89, oldPrice: 162, stock: 15, rating: 4.5 },
];

const SHIPPING_METHODS = [
  { name: "Standard", description: "5-7 business days", price: 0, etaDays: "5-7 business days" },
  { name: "Express", description: "2-3 business days", price: 18, etaDays: "2-3 business days" },
  { name: "Next day", description: "Arrives tomorrow", price: 32, etaDays: "Next business day" },
];

const COUPONS = [
  { code: "Veluntra10", type: "percent", value: 10, usageLimit: 500, perUserLimit: 1, expiresAt: daysFromNow(60) },
  { code: "WELCOME15", type: "percent", value: 15, usageLimit: 1000, perUserLimit: 1, expiresAt: daysFromNow(90) },
  { code: "FREESHIP", type: "free_shipping", value: 0, usageLimit: 200, perUserLimit: 2, expiresAt: daysFromNow(30) },
  { code: "SAVE20", type: "fixed", value: 20, minSubtotal: 150, usageLimit: 500, perUserLimit: 1, expiresAt: daysFromNow(45) },
];

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
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

  // ---------- Categories & Brands ----------
  const FEATURED_CATEGORIES = new Set(["Audio", "Smart Home", "Computing", "Home & Kitchen"]);
  const categoryByName = {};
  for (const name of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { featured: FEATURED_CATEGORIES.has(name) },
      create: { name, slug: slugify(name), featured: FEATURED_CATEGORIES.has(name) },
    });
    categoryByName[name] = cat;
  }

  const FEATURED_BRANDS = new Set(["Veluntra", "Nexora", "Meridian"]);
  const brandByName = {};
  for (const name of BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: { featured: FEATURED_BRANDS.has(name) },
      create: { name, slug: slugify(name), featured: FEATURED_BRANDS.has(name) },
    });
    brandByName[name] = brand;
  }

  // ---------- Shipping methods ----------
  for (const method of SHIPPING_METHODS) {
    const existing = await prisma.shippingMethod.findFirst({ where: { name: method.name } });
    if (!existing) await prisma.shippingMethod.create({ data: method });
  }

  // ---------- Coupons ----------
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, update: {}, create: coupon });
  }

  // ---------- Products ----------
  let created = 0;
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) continue;

    const category = categoryByName[p.category];
    const brand = brandByName[p.brand];
    const skuPrefix = `${category.slug.slice(0, 3)}-${brand.slug.slice(0, 3)}`.toUpperCase();
    const sku = `${skuPrefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: category.id,
        brandId: brand.id,
        name: p.name,
        slug: slugify(p.name),
        sku,
        description: `${p.name} — a ${category.name.toLowerCase()} essential from ${brand.name}, built for everyday performance and reliability.`,
        price: p.price,
        oldPrice: p.oldPrice || null,
        costPrice: Math.round(p.price * 0.6 * 100) / 100,
        stock: p.stock,
        lowStockThreshold: 10,
        status: "published",
        isNew: Boolean(p.isNew),
        ratingAvg: p.rating || 0,
        ratingCount: p.rating ? Math.floor(50 + Math.random() * 250) : 0,
        options: p.options ? { create: p.options } : undefined,
        variants: p.variants
          ? {
              create: p.variants.map((v, i) => ({
                sku: `${sku}-V${i + 1}`,
                combination: v.combination,
                stock: v.stock,
              })),
            }
          : undefined,
      },
    });
    created += 1;
  }

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

  // ---------- A sample flash-sale promotion ----------
  const existingPromo = await prisma.promotion.findFirst({ where: { name: "Launch Week Flash Sale" } });
  if (!existingPromo) {
    await prisma.promotion.create({
      data: {
        name: "Launch Week Flash Sale",
        type: "flash_sale",
        scope: "category",
        categoryId: categoryByName["Audio"].id,
        value: 15,
        enabled: true,
        startsAt: new Date(),
        endsAt: daysFromNow(7),
      },
    });
  }

  // ---------- Homepage CMS default sections ----------
  const HOMEPAGE_SECTIONS = [
    "categories",
    "featured_products",
    "trending_products",
    "flash_sale",
    "best_sellers",
    "collections",
    "brands",
    "testimonials",
  ];
  const sectionCount = await prisma.homepageSection.count();
  if (sectionCount === 0) {
    for (const [position, type] of HOMEPAGE_SECTIONS.entries()) {
      await prisma.homepageSection.create({ data: { type, position, enabled: true } });
    }
  }

  console.log(`Seed complete. Created ${created} new products.`);
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
