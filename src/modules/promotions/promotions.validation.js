const { z } = require("zod");

const PROMOTION_TYPES = [
  "flash_sale",
  "deal_of_day",
  "bogo",
  "percentage",
  "fixed",
  "category_discount",
  "brand_discount",
  "product_discount",
  "first_order",
  "festival",
];

const createPromotionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(PROMOTION_TYPES),
    scope: z.enum(["all", "category", "brand", "product"]).default("all"),
    categoryId: z.string().uuid().optional().nullable(),
    brandId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    value: z.coerce.number().min(0).optional().nullable(),
    buyQuantity: z.coerce.number().int().min(1).optional().nullable(),
    getQuantity: z.coerce.number().int().min(1).optional().nullable(),
    enabled: z.coerce.boolean().default(true),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((data) => data.endsAt > data.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });

const updatePromotionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  value: z.coerce.number().min(0).optional().nullable(),
  buyQuantity: z.coerce.number().int().min(1).optional().nullable(),
  getQuantity: z.coerce.number().int().min(1).optional().nullable(),
  enabled: z.coerce.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

module.exports = { createPromotionSchema, updatePromotionSchema, PROMOTION_TYPES };
