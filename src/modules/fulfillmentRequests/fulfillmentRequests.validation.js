const { z } = require("zod");

const createFulfillmentRequestSchema = z.object({
  orderId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  sellerNote: z.string().trim().max(500).optional(),
});

const resolveFulfillmentRequestSchema = z.object({
  adminNote: z.string().trim().max(500).optional(),
});

module.exports = { createFulfillmentRequestSchema, resolveFulfillmentRequestSchema };
