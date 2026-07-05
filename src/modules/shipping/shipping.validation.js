const { z } = require("zod");

const createShippingMethodSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(0),
  etaDays: z.string().trim().min(1).max(40),
});

const updateShippingMethodSchema = createShippingMethodSchema.partial();

module.exports = { createShippingMethodSchema, updateShippingMethodSchema };
