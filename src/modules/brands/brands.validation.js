const { z } = require("zod");

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(80).optional(),
  logoUrl: z.string().url().optional().nullable(),
  featured: z.coerce.boolean().optional(),
  position: z.coerce.number().int().min(0).optional(),
});

const updateBrandSchema = createBrandSchema.partial();

const reorderBrandsSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.coerce.number().int().min(0) })).min(1),
});

module.exports = { createBrandSchema, updateBrandSchema, reorderBrandsSchema, slugify };
