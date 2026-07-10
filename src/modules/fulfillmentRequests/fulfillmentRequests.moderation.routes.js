const { Router } = require("express");
const validate = require("../../middleware/validate");
const { resolveFulfillmentRequestSchema } = require("./fulfillmentRequests.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const controller = require("./fulfillmentRequests.controller");

// Mounted under /admin/fulfillment-requests (auth + admin role already enforced by admin.routes.js).
const router = Router();

/**
 * @openapi
 * /admin/fulfillment-requests:
 *   get:
 *     tags: [Admin]
 *     summary: List seller requests to fulfill order items from the Veluntra warehouse
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post(
  "/:id/approve",
  validate({ params: idParamSchema(), body: resolveFulfillmentRequestSchema }),
  controller.approve
);
router.post(
  "/:id/reject",
  validate({ params: idParamSchema(), body: resolveFulfillmentRequestSchema }),
  controller.reject
);

module.exports = router;
