const { randomBytes } = require("crypto");
const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const { logActivity } = require("../../utils/activityLog");
const { logInventoryChange } = require("../../utils/inventoryLog");
const { slugify } = require("./products.validation");

const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  images: { orderBy: { position: "asc" } },
  options: true,
  variants: true,
};

const SORT_MAP = {
  "price-asc": { price: "asc" },
  "price-desc": { price: "desc" },
  rating: { ratingAvg: "desc" },
  newest: { createdAt: "desc" },
  featured: { createdAt: "desc" },
  "best-selling": { orderItems: { _count: "desc" } },
};

function randomCode(length = 5) {
  return randomBytes(length).toString("hex").slice(0, length).toUpperCase();
}

async function generateUniqueSlug(name) {
  const base = slugify(name);
  let candidate = base;
  let i = 1;
  while (await prisma.product.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${i++}`;
  }
  return candidate;
}

async function generateUniqueSku(category, brand) {
  const prefix = `${(category?.slug || "GEN").slice(0, 3)}-${(brand?.slug || "VNT").slice(0, 3)}`.toUpperCase();
  let candidate = `${prefix}-${randomCode()}`;
  while (await prisma.product.findUnique({ where: { sku: candidate } })) {
    candidate = `${prefix}-${randomCode()}`;
  }
  return candidate;
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = { status: "published", store: { status: "approved" } };

  if (query.category) where.category = { slug: query.category };
  if (query.brand) where.brand = { slug: query.brand };
  if (query.tag) where.tags = { has: query.tag };
  if (query.minRating) where.ratingAvg = { gte: Number(query.minRating) };
  // Homepage merchandising flags — admin/seller-controlled, set via bulkUpdateFeatureFlags
  // or the product form. Falls back to sort-only behavior when not requested.
  if (query.featured === "true" || query.featured === true) where.isFeatured = true;
  if (query.trending === "true" || query.trending === true) where.isTrending = true;
  if (query.bestSeller === "true" || query.bestSeller === true) where.isBestSeller = true;
  if (query.isNew === "true" || query.isNew === true) where.isNew = true;
  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = query.minPrice;
    if (query.maxPrice) where.price.lte = query.maxPrice;
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: SORT_MAP[query.sort] || SORT_MAP.featured,
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return { items: items.map(toPublicProduct), page, limit, total };
}

/** Public storefront detail — also counts as a "view" for conversion-rate analytics. */
async function getById(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      ...PRODUCT_INCLUDE,
      reviews: { where: { status: "approved" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!product) throw ApiError.notFound("Product not found.");

  await prisma.product.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

  const breakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = product.reviews.filter((r) => r.rating === stars).length;
    const percent = product.reviews.length ? Math.round((count / product.reviews.length) * 100) : 0;
    return { stars, percent };
  });

  return toPublicProduct({ ...product, ratingBreakdown: breakdown });
}

/** Admin/seller edit-form detail — full data (cost price, reserved stock), no status/store-approval filtering. */
async function getByIdForManage(id, { storeId, isAdmin }) {
  const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  if (!product) throw ApiError.notFound("Product not found.");
  if (!isAdmin && product.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");
  return toPlain({ ...product, availableStock: Math.max(product.stock - product.reservedStock, 0) });
}

/** Public-facing shape: strips cost basis (never shown to customers) and marks out-of-stock variants. */
function toPublicProduct(product) {
  const plain = toPlain(product);
  delete plain.costPrice;
  delete plain.reservedStock;
  if (plain.variants) {
    plain.variants = plain.variants.map((v) => ({ ...v, available: v.stock > 0 }));
  }
  return plain;
}

async function create(data, { storeId, actorId, ipAddress }) {
  const { images, options, variants, slug, sku, ...rest } = data;

  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
  if (!category) throw ApiError.badRequest("Invalid categoryId.");
  if (!brand) throw ApiError.badRequest("Invalid brandId.");

  const finalSlug = slug ? slugify(slug) : await generateUniqueSlug(data.name);
  const finalSku = sku || (await generateUniqueSku(category, brand));

  const product = await prisma.product.create({
    data: {
      ...rest,
      slug: finalSlug,
      sku: finalSku,
      storeId,
      images: { create: images.map((url, position) => ({ url, position })) },
      options: { create: options },
      variants: {
        create: variants.map((v) => ({
          sku: v.sku || `${finalSku}-${randomCode(3)}`,
          barcode: v.barcode,
          combination: v.combination,
          price: v.price,
          stock: v.stock,
          weight: v.weight,
          imageUrl: v.imageUrl,
          isActive: v.isActive,
        })),
      },
    },
    include: PRODUCT_INCLUDE,
  });

  if (product.stock > 0) {
    await logInventoryChange({
      productId: product.id,
      type: "initial_stock",
      quantityBefore: 0,
      quantityAfter: product.stock,
      actorId,
      reason: "Initial stock on product creation",
    });
  }

  await logActivity({
    actorId,
    action: `Created product "${product.name}"`,
    scope: "products",
    entityType: "Product",
    entityId: product.id,
    newValue: { name: product.name, sku: product.sku, price: Number(product.price), status: product.status },
    ipAddress,
  });

  return toPlain(product);
}

async function update(id, data, { storeId, isAdmin, actorId, ipAddress }) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Product not found.");
  if (!isAdmin && existing.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");

  const { images, options, variants, slug, ...rest } = data;

  const product = await prisma.$transaction(async (tx) => {
    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: images.map((url, position) => ({ productId: id, url, position })),
      });
    }
    if (options) {
      await tx.productOption.deleteMany({ where: { productId: id } });
      await tx.productOption.createMany({ data: options.map((o) => ({ ...o, productId: id })) });
    }
    if (variants) {
      await tx.productVariant.deleteMany({ where: { productId: id } });
      for (const v of variants) {
        await tx.productVariant.create({
          data: {
            productId: id,
            sku: v.sku || `${existing.sku}-${randomCode(3)}`,
            barcode: v.barcode,
            combination: v.combination,
            price: v.price,
            stock: v.stock,
            weight: v.weight,
            imageUrl: v.imageUrl,
            isActive: v.isActive,
          },
        });
      }
    }
    const updatedProduct = await tx.product.update({
      where: { id },
      data: { ...rest, slug: slug ? slugify(slug) : undefined },
      include: PRODUCT_INCLUDE,
    });

    if (typeof rest.stock === "number" && rest.stock !== existing.stock) {
      await logInventoryChange(
        {
          productId: id,
          type: "manual_adjustment",
          quantityBefore: existing.stock,
          quantityAfter: rest.stock,
          actorId,
          reason: "Stock edited via product update",
        },
        tx
      );
    }

    await logActivity({
      tx,
      actorId,
      action: `Updated product "${existing.name}"`,
      scope: "products",
      entityType: "Product",
      entityId: id,
      previousValue: { name: existing.name, price: Number(existing.price), stock: existing.stock, status: existing.status },
      newValue: { name: updatedProduct.name, price: Number(updatedProduct.price), stock: updatedProduct.stock, status: updatedProduct.status },
      ipAddress,
    });

    return updatedProduct;
  });

  return toPlain(product);
}

async function remove(id, { storeId, isAdmin, actorId, ipAddress }) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Product not found.");
  if (!isAdmin && existing.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");
  await prisma.product.delete({ where: { id } });
  await logActivity({
    actorId,
    action: `Deleted product "${existing.name}"`,
    scope: "products",
    entityType: "Product",
    entityId: id,
    previousValue: { name: existing.name, sku: existing.sku },
    ipAddress,
  });
}

/** Manual, reason-tracked stock adjustment (damaged stock, warehouse recount, etc.) — signed delta. */
async function adjustStock(id, { variantId, quantity, reason }, { storeId, isAdmin, actorId, ipAddress }) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Product not found.");
  if (!isAdmin && existing.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");

  const result = await prisma.$transaction(async (tx) => {
    if (variantId) {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.productId !== id) throw ApiError.notFound("Variant not found.");
      const quantityAfter = Math.max(variant.stock + quantity, 0);
      const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stock: quantityAfter } });
      await logInventoryChange(
        { productId: id, variantId, type: "manual_adjustment", quantityBefore: variant.stock, quantityAfter, actorId, reason },
        tx
      );
      return updated;
    }
    const quantityAfter = Math.max(existing.stock + quantity, 0);
    const updated = await tx.product.update({ where: { id }, data: { stock: quantityAfter } });
    await logInventoryChange(
      { productId: id, type: "manual_adjustment", quantityBefore: existing.stock, quantityAfter, actorId, reason },
      tx
    );
    return updated;
  });

  await logActivity({
    actorId,
    action: `Adjusted stock for "${existing.name}" by ${quantity > 0 ? "+" : ""}${quantity} (${reason})`,
    scope: "products",
    entityType: "Product",
    entityId: id,
    ipAddress,
  });

  return toPlain(result);
}

/** Inventory transaction history for one product (or narrowed to admin-wide with storeId omitted). */
async function inventoryHistory(id, { storeId, isAdmin }, query) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw ApiError.notFound("Product not found.");
  if (!isAdmin && product.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");

  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 30 });
  const [items, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: { productId: id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.inventoryTransaction.count({ where: { productId: id } }),
  ]);
  return {
    items: items.map((t) => toPlain({ ...t, actorName: t.actor?.name || "System", actor: undefined })),
    page,
    limit,
    total,
  };
}

/** Per-product performance: views, sales, revenue, profit, conversion, wishlist/review counts, returns/refunds. */
async function getAnalytics(id, { storeId, isAdmin }) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw ApiError.notFound("Product not found.");
  if (!isAdmin && product.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");

  const [salesAgg, wishlistCount, reviewAgg, returns, refundedAgg] = await Promise.all([
    prisma.orderItem.aggregate({
      where: { productId: id, order: { status: { not: "cancelled" } } },
      _sum: { quantity: true },
    }),
    prisma.wishlistItem.count({ where: { productId: id } }),
    prisma.review.aggregate({ where: { productId: id, status: "approved" }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.orderItem.aggregate({
      where: { productId: id, order: { status: { in: ["returned", "exchanged"] } } },
      _sum: { quantity: true },
    }),
    prisma.orderItem.findMany({
      where: { productId: id, order: { paymentStatus: "refunded" } },
      select: { quantity: true, priceSnapshot: true },
    }),
  ]);

  const unitsSold = salesAgg._sum.quantity || 0;
  const revenue = Math.round(unitsSold * Number(product.price) * 100) / 100;
  const profit = product.costPrice != null ? Math.round(unitsSold * (Number(product.price) - Number(product.costPrice)) * 100) / 100 : null;
  const marginPercent = product.costPrice != null && Number(product.price) > 0
    ? Math.round(((Number(product.price) - Number(product.costPrice)) / Number(product.price)) * 1000) / 10
    : null;
  const discountPercent = product.oldPrice && Number(product.oldPrice) > 0
    ? Math.round(((Number(product.oldPrice) - Number(product.price)) / Number(product.oldPrice)) * 1000) / 10
    : 0;
  const refundAmount = refundedAgg.reduce((sum, i) => sum + Number(i.priceSnapshot) * i.quantity, 0);

  return {
    views: product.views,
    unitsSold,
    revenue,
    profit,
    marginPercent,
    discountPercent,
    conversionRate: product.views > 0 ? Math.round((unitsSold / product.views) * 1000) / 10 : 0,
    wishlistCount,
    reviewCount: reviewAgg._count.rating,
    averageRating: reviewAgg._avg.rating || 0,
    unitsReturned: returns._sum.quantity || 0,
    refundAmount: Math.round(refundAmount * 100) / 100,
  };
}

async function bulkFindOwned(ids, { storeId, isAdmin }) {
  const where = { id: { in: ids } };
  if (!isAdmin) where.storeId = storeId;
  const products = await prisma.product.findMany({ where });
  if (products.length !== ids.length) {
    throw ApiError.forbidden("One or more products were not found or are not owned by your store.");
  }
  return products;
}

async function bulkUpdatePrice(ids, { mode, value }, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  await prisma.$transaction(
    products.map((p) => {
      const current = Number(p.price);
      const next =
        mode === "set"
          ? value
          : mode === "increase_percent"
          ? current * (1 + value / 100)
          : mode === "decrease_percent"
          ? current * (1 - value / 100)
          : mode === "increase_flat"
          ? current + value
          : current - value;
      return prisma.product.update({ where: { id: p.id }, data: { price: Math.max(Math.round(next * 100) / 100, 0) } });
    })
  );
  await logActivity({
    actorId,
    action: `Bulk price update (${mode}, ${value}) on ${products.length} products`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { mode, value, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

async function bulkUpdateStock(ids, { mode, value, reason }, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  await prisma.$transaction(async (tx) => {
    for (const p of products) {
      const next = mode === "set" ? value : mode === "increase" ? p.stock + value : Math.max(p.stock - value, 0);
      await tx.product.update({ where: { id: p.id }, data: { stock: next } });
      await logInventoryChange(
        { productId: p.id, type: "bulk_adjustment", quantityBefore: p.stock, quantityAfter: next, actorId, reason: reason || `Bulk stock update (${mode}, ${value})` },
        tx
      );
    }
  });
  await logActivity({
    actorId,
    action: `Bulk stock update (${mode}, ${value}) on ${products.length} products`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { mode, value, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

async function bulkUpdateStatus(ids, status, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status } });
  await logActivity({
    actorId,
    action: `Bulk set status "${status}" on ${products.length} products`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { status, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

/** Bulk toggle the homepage merchandising flags (Featured/Trending/Best Seller/New) and/or badge text. */
async function bulkUpdateFeatureFlags(ids, flags, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  const data = {};
  if (typeof flags.isFeatured === "boolean") data.isFeatured = flags.isFeatured;
  if (typeof flags.isTrending === "boolean") data.isTrending = flags.isTrending;
  if (typeof flags.isBestSeller === "boolean") data.isBestSeller = flags.isBestSeller;
  if (typeof flags.isNew === "boolean") data.isNew = flags.isNew;
  if (typeof flags.badge === "string" || flags.badge === null) data.badge = flags.badge;

  await prisma.product.updateMany({ where: { id: { in: ids } }, data });
  await logActivity({
    actorId,
    action: `Bulk updated merchandising flags (${Object.keys(data).join(", ")}) on ${products.length} products`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { ...data, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

async function bulkUpdateCategory(ids, categoryId, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest("Invalid categoryId.");
  await prisma.product.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
  await logActivity({
    actorId,
    action: `Bulk moved ${products.length} products to category "${category.name}"`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { categoryId, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

async function bulkUpdateBrand(ids, brandId, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw ApiError.badRequest("Invalid brandId.");
  await prisma.product.updateMany({ where: { id: { in: ids } }, data: { brandId } });
  await logActivity({
    actorId,
    action: `Bulk moved ${products.length} products to brand "${brand.name}"`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { brandId, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

async function bulkUpdateTags(ids, { mode, tags }, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  await prisma.$transaction(
    products.map((p) => {
      const nextTags =
        mode === "set"
          ? tags
          : mode === "add"
          ? Array.from(new Set([...p.tags, ...tags]))
          : p.tags.filter((t) => !tags.includes(t));
      return prisma.product.update({ where: { id: p.id }, data: { tags: nextTags } });
    })
  );
  await logActivity({
    actorId,
    action: `Bulk ${mode} tags [${tags.join(", ")}] on ${products.length} products`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    newValue: { mode, tags, productIds: ids },
    ipAddress,
  });
  const updated = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  return updated.map(toPlain);
}

async function bulkDelete(ids, { storeId, isAdmin, actorId, ipAddress }) {
  const products = await bulkFindOwned(ids, { storeId, isAdmin });
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
  await logActivity({
    actorId,
    action: `Bulk deleted ${products.length} products`,
    scope: "products",
    entityType: "Product",
    entityId: "bulk",
    previousValue: { productIds: ids, names: products.map((p) => p.name) },
    ipAddress,
  });
}

/** Deep-copies a product (images/options/variants) as a new draft — variant/base stock resets to 0. */
async function duplicate(id, { storeId, isAdmin, actorId, ipAddress }) {
  const existing = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  if (!existing) throw ApiError.notFound("Product not found.");
  if (!isAdmin && existing.storeId !== storeId) throw ApiError.forbidden("You do not own this product.");

  const name = `${existing.name} (Copy)`;
  const slug = await generateUniqueSlug(name);
  const sku = await generateUniqueSku(existing.category, existing.brand);

  const product = await prisma.product.create({
    data: {
      storeId: existing.storeId,
      categoryId: existing.categoryId,
      brandId: existing.brandId,
      name,
      slug,
      sku,
      description: existing.description,
      shortDescription: existing.shortDescription,
      price: existing.price,
      oldPrice: existing.oldPrice,
      costPrice: existing.costPrice,
      stock: 0,
      lowStockThreshold: existing.lowStockThreshold,
      status: "draft",
      isNew: true,
      isFeatured: false,
      badge: existing.badge,
      tags: existing.tags,
      highlights: existing.highlights,
      specifications: existing.specifications,
      videos: existing.videos,
      warranty: existing.warranty,
      countryOfOrigin: existing.countryOfOrigin,
      hsnCode: existing.hsnCode,
      gstClass: existing.gstClass,
      weight: existing.weight,
      length: existing.length,
      width: existing.width,
      height: existing.height,
      shippingClass: existing.shippingClass,
      estimatedDeliveryDays: existing.estimatedDeliveryDays,
      codAvailable: existing.codAvailable,
      metaTitle: existing.metaTitle,
      metaDescription: existing.metaDescription,
      canonicalUrl: existing.canonicalUrl,
      ogImage: existing.ogImage,
      images: { create: existing.images.map((img) => ({ url: img.url, position: img.position })) },
      options: { create: existing.options.map(({ id: _id, productId: _pid, ...o }) => o) },
      variants: {
        create: existing.variants.map((v) => ({
          sku: `${sku}-${randomCode(3)}`,
          barcode: v.barcode,
          combination: v.combination,
          price: v.price,
          stock: 0,
          weight: v.weight,
          imageUrl: v.imageUrl,
          isActive: v.isActive,
        })),
      },
    },
    include: PRODUCT_INCLUDE,
  });

  await logActivity({
    actorId,
    action: `Duplicated product "${existing.name}" as "${name}"`,
    scope: "products",
    entityType: "Product",
    entityId: product.id,
    ipAddress,
  });

  return toPlain(product);
}

/** Recomputes ratingAvg/ratingCount for a product from its approved reviews — called after review moderation. */
async function recalculateRating(productId) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: "approved" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: agg._avg.rating || 0,
      ratingCount: agg._count.rating,
    },
  });
}

// ---------- Bulk import / export ----------

const EXPORT_COLUMNS = ["sku", "name", "category", "brand", "price", "oldPrice", "stock", "status", "description"];

async function exportForStore(storeId) {
  const where = storeId ? { storeId } : {};
  const products = await prisma.product.findMany({ where, include: { category: true, brand: true } });
  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category.name,
    brand: p.brand.name,
    price: Number(p.price),
    oldPrice: p.oldPrice ? Number(p.oldPrice) : "",
    stock: p.stock,
    status: p.status,
    description: p.description,
  }));
}

/** Bulk create/update by SKU. Rows are plain objects (already parsed from CSV/JSON). */
async function bulkImport(rows, { storeId, actorId }) {
  const results = { created: 0, updated: 0, errors: [] };

  // Preload every category/brand/existing-SKU once instead of a per-row round trip —
  // a CSV import can be hundreds of rows.
  const [categories, brands, existingProducts] = await Promise.all([
    prisma.category.findMany(),
    prisma.brand.findMany(),
    prisma.product.findMany({ where: { sku: { in: rows.map((r) => r.sku).filter(Boolean) } } }),
  ]);
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const brandByName = new Map(brands.map((b) => [b.name, b]));
  const existingBySku = new Map(existingProducts.map((p) => [p.sku, p]));

  for (const [index, row] of rows.entries()) {
    try {
      if (!row.sku || !row.name || !row.category || !row.brand || !row.price) {
        throw new Error("Missing required column (sku, name, category, brand, price)");
      }
      const category = categoryByName.get(row.category);
      const brand = brandByName.get(row.brand);
      if (!category) throw new Error(`Unknown category "${row.category}"`);
      if (!brand) throw new Error(`Unknown brand "${row.brand}"`);

      const existing = existingBySku.get(row.sku);
      const nextStock = row.stock ? Number(row.stock) : 0;
      const data = {
        name: row.name,
        categoryId: category.id,
        brandId: brand.id,
        price: Number(row.price),
        oldPrice: row.oldPrice ? Number(row.oldPrice) : null,
        stock: nextStock,
        status: row.status === "published" || row.status === "active" ? "published" : "draft",
        description: row.description || "",
        storeId,
      };

      if (existing) {
        if (existing.storeId !== storeId) throw new Error(`SKU "${row.sku}" belongs to a different store`);
        await prisma.product.update({ where: { sku: row.sku }, data });
        await logInventoryChange({
          productId: existing.id,
          type: "bulk_import",
          quantityBefore: existing.stock,
          quantityAfter: nextStock,
          actorId,
          reason: "CSV bulk import",
        });
        results.updated += 1;
      } else {
        const slug = await generateUniqueSlug(row.name);
        const created = await prisma.product.create({ data: { ...data, sku: row.sku, slug } });
        if (nextStock > 0) {
          await logInventoryChange({
            productId: created.id,
            type: "bulk_import",
            quantityBefore: 0,
            quantityAfter: nextStock,
            actorId,
            reason: "CSV bulk import (new product)",
          });
        }
        results.created += 1;
      }
    } catch (err) {
      results.errors.push({ row: index + 1, message: err.message });
    }
  }

  return results;
}

module.exports = {
  list,
  getById,
  getByIdForManage,
  create,
  update,
  remove,
  adjustStock,
  inventoryHistory,
  getAnalytics,
  recalculateRating,
  exportForStore,
  bulkImport,
  bulkUpdatePrice,
  bulkUpdateStock,
  bulkUpdateStatus,
  bulkUpdateCategory,
  bulkUpdateBrand,
  bulkUpdateTags,
  bulkDelete,
  duplicate,
  EXPORT_COLUMNS,
};
