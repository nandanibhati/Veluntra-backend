const { z } = require("zod");

const createDropshipOrderRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().toLowerCase().email(),
  customerPhone: z.string().trim().min(3).max(40),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(30),
  shippingService: z.string().trim().max(120).optional().or(z.literal("")),
  customerReference: z.string().trim().max(120).optional().or(z.literal("")),
  specialInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
});

const setStatusSchema = z.object({
  status: z.enum(["new", "processing", "fulfilled", "cancelled"]),
});

module.exports = { createDropshipOrderRequestSchema, setStatusSchema };
