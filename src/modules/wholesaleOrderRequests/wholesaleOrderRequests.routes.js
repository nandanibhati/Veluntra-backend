const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { idParamSchema } = require("../../utils/commonSchemas");
const { createWholesaleOrderRequestSchema, setStatusSchema } = require("./wholesaleOrderRequests.validation");
const controller = require("./wholesaleOrderRequests.controller");

const router = Router();

/**
 * @openapi
 * /wholesale-order-requests:
 *   post:
 *     tags: [WholesaleOrderRequests]
 *     summary: Submit a manual bulk order request — wholesaler or admin only
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [WholesaleOrderRequests]
 *     summary: List order requests — a wholesaler sees only their own, admin sees everyone's
 *     security: [{ bearerAuth: [] }]
 */
router.post("/", requireAuth, requireRole("wholesaler", "admin"), validate({ body: createWholesaleOrderRequestSchema }), controller.create);
router.get("/", requireAuth, requireRole("wholesaler", "admin"), controller.list);

/**
 * @openapi
 * /wholesale-order-requests/{id}/status:
 *   patch:
 *     tags: [WholesaleOrderRequests]
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
