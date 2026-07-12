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
  // "card" covers Stripe Checkout as a whole — card, Apple Pay, and Google Pay are all offered
  // on Stripe's own hosted page based on the customer's device, not chosen separately here.
  // "demo_card" is a no-Stripe-required stand-in that marks the order paid immediately, gated
  // behind the demoCard feature flag — for demoing the full order flow before real Stripe keys
  // are configured. (paypal/applepay remain valid at the database level for old orders but are
  // no longer accepted as new input.)
  paymentMethod: z.enum(["card", "cod", "demo_card"]).default("card"),
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

const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  email: z.string().trim().toLowerCase().email(),
});

module.exports = { createOrderSchema, updateOrderStatusSchema, assignSellerSchema, requestActionSchema, trackOrderSchema };
