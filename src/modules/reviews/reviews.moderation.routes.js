const { Router } = require("express");
const { z } = require("zod");
const validate = require("../../middleware/validate");
const controller = require("./reviews.controller");

// Mounted under /admin/reviews (auth + admin role already enforced by admin.routes.js).
const router = Router();

const featuredSchema = z.object({ isFeatured: z.coerce.boolean() });
const replySchema = z.object({ reply: z.string().trim().min(1).max(1000) });

/**
 * @openapi
 * /admin/reviews:
 *   get:
 *     tags: [Admin]
 *     summary: List all reviews for moderation (any status)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.listForModeration);
router.post("/:reviewId/approve", controller.approve);
router.post("/:reviewId/reject", controller.reject);
router.patch("/:reviewId/featured", validate({ body: featuredSchema }), controller.setFeatured);
router.post("/:reviewId/reply", validate({ body: replySchema }), controller.reply);
router.delete("/:reviewId", controller.remove);

module.exports = router;
