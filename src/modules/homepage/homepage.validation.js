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

// Base fields with no default on `enabled` — used as-is for updates/drafts, so a partial
// edit that never mentions `enabled` doesn't silently reset it (Zod's `.partial()` does NOT
// strip a field's `.default()`, so building updateSectionSchema from a schema that already
// defaults `enabled` to true would silently re-enable a disabled section on every edit).
const sectionFieldsSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: z.string().trim().max(160).optional().nullable(),
  config: z.record(z.string(), z.any()).optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
  enabled: z.coerce.boolean().optional(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

const createSectionSchema = sectionFieldsSchema.extend({
  enabled: z.coerce.boolean().default(true),
});

const updateSectionSchema = sectionFieldsSchema.partial();

const reorderSectionsSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.coerce.number().int().min(0) })).min(1),
});

const restoreSectionSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

module.exports = { SECTION_TYPES, createSectionSchema, updateSectionSchema, reorderSectionsSchema, restoreSectionSchema };
