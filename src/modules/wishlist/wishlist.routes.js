const { Router } = require("express");
const { z } = require("zod");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./wishlist.controller");

const router = Router();
router.use(requireAuth);

const addSchema = z.object({ productId: z.string().uuid() });

/**
 * @openapi
 * /wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: List the current user's wishlist
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Wishlist]
 *     summary: Add a product to the wishlist
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post("/", validate({ body: addSchema }), controller.add);

/**
 * @openapi
 * /wishlist/{productId}:
 *   delete:
 *     tags: [Wishlist]
 *     summary: Remove a product from the wishlist
 *     security: [{ bearerAuth: [] }]
 */
router.delete("/:productId", controller.remove);

module.exports = router;
