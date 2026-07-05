const { z } = require("zod");

const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).default("GB"),
  phone: z.string().trim().max(30).optional().nullable(),
  isDefault: z.coerce.boolean().optional().default(false),
});

const updateAddressSchema = addressSchema.partial();

module.exports = { addressSchema, updateAddressSchema };
