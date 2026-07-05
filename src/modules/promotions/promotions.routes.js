const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createPromotionSchema, updatePromotionSchema } = require("./promotions.validation");
const controller = require("./promotions.controller");

const router = Router();

/**
 * @openapi
 * /promotions/active:
 *   get:
 *     tags: [Promotions]
 *     summary: List currently-active promotions (public — for storefront banners)
 */
router.get("/active", controller.listActive);

/**
 * @openapi
 * /promotions:
 *   get:
 *     tags: [Promotions]
 *     summary: List all promotions, any status (admin only)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Promotions]
 *     summary: Create a promotion — flash sale, deal of the day, BOGO, category/brand/product discount, etc. Starts/ends automatically based on date & time.
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", requireAuth, requireRole("admin"), controller.list);
router.post("/", requireAuth, requireRole("admin"), validate({ body: createPromotionSchema }), controller.create);

/**
 * @openapi
 * /promotions/{id}:
 *   patch:
 *     tags: [Promotions]
 *     summary: Update a promotion (admin only)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Promotions]
 *     summary: Delete a promotion (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/:id", requireAuth, requireRole("admin"), validate({ body: updatePromotionSchema }), controller.update);
router.delete("/:id", requireAuth, requireRole("admin"), controller.remove);

module.exports = router;
