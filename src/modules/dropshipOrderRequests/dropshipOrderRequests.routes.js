const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { idParamSchema } = require("../../utils/commonSchemas");
const { createDropshipOrderRequestSchema, setStatusSchema } = require("./dropshipOrderRequests.validation");
const controller = require("./dropshipOrderRequests.controller");

const router = Router();

/**
 * @openapi
 * /dropship-order-requests:
 *   post:
 *     tags: [DropshipOrderRequests]
 *     summary: Submit a manual order request for an end customer — dropshipper or admin only
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [DropshipOrderRequests]
 *     summary: List order requests — a dropshipper sees only their own, admin sees everyone's
 *     security: [{ bearerAuth: [] }]
 */
router.post("/", requireAuth, requireRole("dropshipper", "admin"), validate({ body: createDropshipOrderRequestSchema }), controller.create);
router.get("/", requireAuth, requireRole("dropshipper", "admin"), controller.list);

/**
 * @openapi
 * /dropship-order-requests/{id}/status:
 *   patch:
 *     tags: [DropshipOrderRequests]
 *     summary: Update fulfillment status — admin only
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin"),
  validate({ params: idParamSchema(), body: setStatusSchema }),
  controller.setStatus
);

module.exports = router;
