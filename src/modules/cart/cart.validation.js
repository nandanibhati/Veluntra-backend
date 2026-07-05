const { z } = require("zod");

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  variant: z.record(z.string(), z.string()).optional(), // e.g. { color: "Black", size: "44mm" }
});

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(20),
});

const applyCouponSchema = z.object({
  code: z.string().trim().min(1),
});

module.exports = { addItemSchema, updateItemSchema, applyCouponSchema };
