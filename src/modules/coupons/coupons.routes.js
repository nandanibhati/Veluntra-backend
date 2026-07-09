const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createCouponSchema, updateCouponSchema } = require("./coupons.validation");
const controller = require("./coupons.controller");

const router = Router();
router.use(requireAuth, requireRole("seller", "dropshipper", "admin"));

// Admins manage every coupon; sellers only ever see/manage their own store's coupons
// (gated further by Settings.allowSellerCoupons inside the service). Validating/applying
// a code at checkout happens through /cart/coupon, not here.

/**
 * @openapi
 * /coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: List coupons (admin sees all; seller sees only their own store's)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Coupons]
 *     summary: Create a coupon (admin creates platform-wide; seller creates scoped to their own store)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post("/", validate({ body: createCouponSchema }), controller.create);

/**
 * @openapi
 * /coupons/{id}:
 *   patch:
 *     tags: [Coupons]
 *     summary: Update a coupon (admin — any; seller — only their own)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Coupons]
 *     summary: Delete a coupon (admin — any; seller — only their own)
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/:id", validate({ body: updateCouponSchema }), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
