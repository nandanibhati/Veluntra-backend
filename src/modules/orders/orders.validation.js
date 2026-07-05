const { z } = require("zod");

const guestAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).default("GB"),
  phone: z.string().trim().max(30).optional().nullable(),
});

const createOrderSchema = z.object({
  // Logged-in checkout uses a saved address; guest checkout supplies one inline instead.
  shippingAddressId: z.string().uuid().optional(),
  shippingMethodId: z.string().uuid(),
  paymentMethod: z.enum(["card", "paypal", "applepay", "cod"]).default("card"),
  guestEmail: z.string().email().optional(),
  guestName: z.string().trim().min(1).max(120).optional(),
  guestAddress: guestAddressSchema.optional(),
});

const updateOrderStatusSchema = z.object({
  status: z
    .enum([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "return_requested",
      "returned",
      "exchange_requested",
      "exchanged",
    ])
    .optional(),
  paymentStatus: z.enum(["pending", "paid", "refunded"]).optional(),
  trackingNumber: z.string().max(80).optional().nullable(),
  trackingCarrier: z.string().max(60).optional().nullable(),
  trackingUrl: z.string().url().optional().nullable(),
  returnReason: z.string().max(500).optional().nullable(),
  refundAmount: z.coerce.number().min(0).optional().nullable(),
});

const assignSellerSchema = z.object({
  storeId: z.string().uuid(),
});

const requestActionSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

module.exports = { createOrderSchema, updateOrderStatusSchema, assignSellerSchema, requestActionSchema };
