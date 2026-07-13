const { z } = require("zod");

const PRODUCT_STATUSES = ["draft", "published", "archived", "hidden", "upcoming", "discontinued"];

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const specSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });

// Per-product override of the global animation preset. Null/omitted = inherit global.
const animationOverrideSchema = z
  .object({
    enabled: z.boolean().optional(),
    type: z.enum(["float", "breathe", "tilt", "glow", "shine", "pulse", "none"]).optional(),
    speed: z.enum(["slow", "normal", "fast"]).optional(),
    intensity: z.enum(["subtle", "normal", "strong"]).optional(),
    heroHighlight: z.boolean().optional(),
    homepageHighlight: z.boolean().optional(),
  })
  .optional()
  .nullable();

const variantSchema = z.object({
  sku: z.string().trim().min(1).max(64).optional(),
  barcode: z.string().trim().max(64).optional().nullable(),
  combination: z.record(z.string(), z.string()),
  price: z.coerce.number().positive().optional().nullable(),
  stock: z.coerce.number().int().min(0).default(0),
  weight: z.coerce.number().positive().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.coerce.boolean().default(true),
});

const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  brandId: z.string().uuid(),
  storeId: z.string().uuid().optional(), // admin only — sellers are pinned to their own store
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(220).optional(),
  sku: z.string().trim().min(2).max(64).optional(), // auto-generated if omitted
  barcode: z.string().trim().max(64).optional().nullable(),
  description: z.string().trim().min(1),
  shortDescription: z.string().trim().max(300).optional().nullable(),
  price: z.coerce.number().positive(),
  oldPrice: z.coerce.number().positive().optional().nullable(),
  costPrice: z.coerce.number().positive().optional().nullable(), // used for profit analytics only, never shown to customers
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  status: z.enum(PRODUCT_STATUSES).default("draft"),
  isNew: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  isTrending: z.coerce.boolean().default(false),
  isBestSeller: z.coerce.boolean().default(false),
  badge: z.string().max(40).optional().nullable(),
  animationOverride: animationOverrideSchema,
  tags: z.array(z.string().trim().min(1).max(40)).optional().default([]),
  highlights: z.array(z.string()).optional().default([]),
  specifications: z.array(specSchema).optional().default([]),
  images: z.array(z.string().url()).optional().default([]),
  videos: z.array(z.string().url()).optional().default([]),
  warranty: z.string().max(200).optional().nullable(),
  countryOfOrigin: z.string().max(80).optional().nullable(),
  hsnCode: z.string().max(20).optional().nullable(),
  gstClass: z.string().max(20).optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  length: z.coerce.number().positive().optional().nullable(),
  width: z.coerce.number().positive().optional().nullable(),
  height: z.coerce.number().positive().optional().nullable(),
  shippingClass: z.string().max(60).optional().nullable(),
  estimatedDeliveryDays: z.coerce.number().int().min(0).optional().nullable(),
  codAvailable: z.coerce.boolean().default(true),
  metaTitle: z.string().max(160).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  canonicalUrl: z.string().url().optional().nullable(),
  ogImage: z.string().url().optional().nullable(),
  options: z
    .array(
      z.object({
        kind: z.enum(["color", "size", "storage", "material", "custom"]),
        label: z.string(),
        extra: z.string().optional(),
        inStock: z.boolean().default(true),
      })
    )
    .optional()
    .default([]),
  variants: z.array(variantSchema).optional().default([]),
});

// `.partial()` alone isn't enough: fields defined with `.default(...)` above still apply that
// default when the key is simply absent from a PATCH body, silently resetting them (e.g. an
// edit that omits `codAvailable` would re-enable COD, or omitting `status` would unpublish the
// product). Re-declaring those fields here without `.default()` keeps a truly partial update —
// an omitted key leaves the existing DB value untouched.
const updateProductSchema = createProductSchema.partial().extend({
  stock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  isNew: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isTrending: z.coerce.boolean().optional(),
  isBestSeller: z.coerce.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  highlights: z.array(z.string()).optional(),
  specifications: z.array(specSchema).optional(),
  images: z.array(z.string().url()).optional(),
  videos: z.array(z.string().url()).optional(),
  codAvailable: z.coerce.boolean().optional(),
  options: z
    .array(
      z.object({
        kind: z.enum(["color", "size", "storage", "material", "custom"]),
        label: z.string(),
        extra: z.string().optional(),
        inStock: z.boolean().optional(),
      })
    )
    .optional(),
  variants: z.array(variantSchema).optional(),
});

const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  storeId: z.string().uuid().optional(),
  ids: z.string().optional(), // comma-separated UUIDs — "manual selection" product sources (homepage sections, etc.)
  tag: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  search: z.string().optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "rating", "newest", "best-selling"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  trending: z.enum(["true", "false"]).optional(),
  bestSeller: z.enum(["true", "false"]).optional(),
  isNew: z.enum(["true", "false"]).optional(),
});

const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

const bulkPriceUpdateSchema = bulkIdsSchema.extend({
  mode: z.enum(["set", "increase_percent", "decrease_percent", "increase_flat", "decrease_flat"]),
  value: z.coerce.number().min(0),
});

const bulkStockUpdateSchema = bulkIdsSchema.extend({
  mode: z.enum(["set", "increase", "decrease"]),
  value: z.coerce.number().int().min(0),
  reason: z.string().max(300).optional(),
});

const bulkStatusUpdateSchema = bulkIdsSchema.extend({
  status: z.enum(PRODUCT_STATUSES),
});

const bulkCategoryUpdateSchema = bulkIdsSchema.extend({
  categoryId: z.string().uuid(),
});

const bulkBrandUpdateSchema = bulkIdsSchema.extend({
  brandId: z.string().uuid(),
});

const bulkTagsUpdateSchema = bulkIdsSchema.extend({
  mode: z.enum(["add", "remove", "set"]),
  tags: z.array(z.string().trim().min(1).max(40)).min(1),
});

const bulkDeleteSchema = bulkIdsSchema;

const bulkFeatureFlagsUpdateSchema = bulkIdsSchema.extend({
  isFeatured: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNew: z.boolean().optional(),
  badge: z.string().max(40).optional().nullable(),
});

const stockAdjustmentSchema = z.object({
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int(), // signed delta, e.g. -5 for damaged stock write-off
  reason: z.string().trim().min(1).max(300),
});

module.exports = {
  PRODUCT_STATUSES,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  variantSchema,
  slugify,
  bulkPriceUpdateSchema,
  bulkStockUpdateSchema,
  bulkStatusUpdateSchema,
  bulkCategoryUpdateSchema,
  bulkBrandUpdateSchema,
  bulkTagsUpdateSchema,
  bulkDeleteSchema,
  bulkFeatureFlagsUpdateSchema,
  stockAdjustmentSchema,
};
