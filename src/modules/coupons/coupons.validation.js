const { z } = require("zod");

const createCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(30),
  type: z.enum(["percent", "fixed", "free_shipping"]),
  value: z.coerce.number().min(0),
  scope: z.enum(["all", "category", "brand", "product"]).default("all"),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  storeId: z.string().uuid().optional().nullable(), // admin only — ignored/overridden for sellers
  minSubtotal: z.coerce.number().min(0).optional().nullable(),
  maxDiscount: z.coerce.number().min(0).optional().nullable(),
  usageLimit: z.coerce.number().int().min(1),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  autoApply: z.coerce.boolean().default(false),
  enabled: z.coerce.boolean().default(true),
  expiresAt: z.coerce.date(),
});

const updateCouponSchema = createCouponSchema.partial();

const applyCouponSchema = z.object({
  code: z.string().trim().min(1),
});

module.exports = { createCouponSchema, updateCouponSchema, applyCouponSchema };
