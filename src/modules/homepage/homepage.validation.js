const { z } = require("zod");

const SECTION_TYPES = [
  "hero_banner",
  "slider",
  "categories",
  "featured_products",
  "trending_products",
  "best_sellers",
  "flash_sale",
  "collections",
  "brands",
  "testimonials",
  "announcement",
  "ad_banner",
  "custom",
];

const createSectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: z.string().trim().max(160).optional().nullable(),
  config: z.record(z.string(), z.any()).optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
  enabled: z.coerce.boolean().default(true),
});

const updateSectionSchema = createSectionSchema.partial();

const reorderSectionsSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.coerce.number().int().min(0) })).min(1),
});

module.exports = { SECTION_TYPES, createSectionSchema, updateSectionSchema, reorderSectionsSchema };
