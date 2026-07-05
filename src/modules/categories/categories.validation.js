const { z } = require("zod");

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).optional(),
  imageUrl: z.string().url().optional().nullable(),
  featured: z.coerce.boolean().optional(),
  position: z.coerce.number().int().min(0).optional(),
  metaTitle: z.string().max(160).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

const updateCategorySchema = createCategorySchema.partial();

const reorderCategoriesSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.coerce.number().int().min(0) })).min(1),
});

module.exports = { createCategorySchema, updateCategorySchema, reorderCategoriesSchema, slugify };
