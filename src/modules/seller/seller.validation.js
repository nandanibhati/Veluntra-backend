const { z } = require("zod");

const updateStoreBrandingSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().trim().url().max(500).optional().nullable(),
  contactEmail: z.string().trim().toLowerCase().email().optional().nullable(),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  addressLine1: z.string().trim().max(200).optional().nullable(),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().length(2).optional().nullable(),
});

module.exports = { updateStoreBrandingSchema };
