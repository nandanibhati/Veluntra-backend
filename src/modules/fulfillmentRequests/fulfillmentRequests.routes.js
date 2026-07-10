const { Router } = require("express");
const validate = require("../../middleware/validate");
const { createFulfillmentRequestSchema } = require("./fulfillmentRequests.validation");
const controller = require("./fulfillmentRequests.controller");

// Mounted under /seller/fulfillment-requests (auth + seller/dropshipper/admin role already
// enforced by seller.routes.js).
const router = Router();

/**
 * @openapi
 * /seller/fulfillment-requests:
 *   post:
 *     tags: [Seller]
 *     summary: Request that Veluntra fulfill one of this seller's order items from the warehouse
 *     security: [{ bearerAuth: [] }]
 */
router.post("/", validate({ body: createFulfillmentRequestSchema }), controller.create);

module.exports = router;
