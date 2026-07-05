const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createShippingMethodSchema, updateShippingMethodSchema } = require("./shipping.validation");
const controller = require("./shipping.controller");

const router = Router();

/**
 * @openapi
 * /shipping-methods:
 *   get:
 *     tags: [Shipping]
 *     summary: List available shipping methods (public)
 *   post:
 *     tags: [Shipping]
 *     summary: Create a shipping method (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate({ body: createShippingMethodSchema }),
  controller.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate({ body: updateShippingMethodSchema }),
  controller.update
);
router.delete("/:id", requireAuth, requireRole("admin"), controller.remove);

module.exports = router;
