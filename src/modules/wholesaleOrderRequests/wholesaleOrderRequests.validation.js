const { z } = require("zod");

const createWholesaleOrderRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99999),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(30),
  purchaseOrderReference: z.string().trim().max(120).optional().or(z.literal("")),
  specialInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
});

const setStatusSchema = z.object({
  status: z.enum(["new", "processing", "fulfilled", "cancelled"]),
});

module.exports = { createWholesaleOrderRequestSchema, setStatusSchema };
