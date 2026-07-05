const { Router } = require("express");
const { z } = require("zod");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { createReviewSchema } = require("./reviews.validation");
const controller = require("./reviews.controller");

// mergeParams so this router (mounted at /products/:productId/reviews) can read :productId
const router = Router({ mergeParams: true });

/**
 * @openapi
 * /products/{productId}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: List approved reviews for a product
 *   post:
 *     tags: [Reviews]
 *     summary: Submit a review for a product (auth required, one per user, goes to pending moderation)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post("/", requireAuth, validate({ body: createReviewSchema }), controller.create);

/**
 * @openapi
 * /products/{productId}/reviews/{reviewId}/helpful:
 *   post:
 *     tags: [Reviews]
 *     summary: Mark a review as helpful
 */
router.post("/:reviewId/helpful", controller.markHelpful);

/**
 * @openapi
 * /products/{productId}/reviews/{reviewId}/report:
 *   post:
 *     tags: [Reviews]
 *     summary: Report a review for abuse
 */
router.post("/:reviewId/report", requireAuth, controller.reportAbuse);

module.exports = router;
