const { Router } = require("express");
const validate = require("../../middleware/validate");
const { optionalAuth, requireAuth } = require("../../middleware/auth");
const { addItemSchema, updateItemSchema, applyCouponSchema } = require("./cart.validation");
const controller = require("./cart.controller");

const router = Router();

/**
 * @openapi
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get the current cart (auth via Bearer token, or guest via X-Session-Id header)
 *     parameters:
 *       - in: header
 *         name: X-Session-Id
 *         schema: { type: string }
 *         description: Required for guest (unauthenticated) requests
 */
router.get("/", optionalAuth, controller.getCart);

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add an item to the cart
 */
router.post("/items", optionalAuth, validate({ body: addItemSchema }), controller.addItem);

/**
 * @openapi
 * /cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Update a cart item's quantity
 *   delete:
 *     tags: [Cart]
 *     summary: Remove an item from the cart
 */
router.patch("/items/:itemId", optionalAuth, validate({ body: updateItemSchema }), controller.updateItem);
router.delete("/items/:itemId", optionalAuth, controller.removeItem);

/**
 * @openapi
 * /cart/coupon:
 *   post:
 *     tags: [Cart]
 *     summary: Apply a coupon code to the cart
 *   delete:
 *     tags: [Cart]
 *     summary: Remove the applied coupon
 */
router.post("/coupon", optionalAuth, validate({ body: applyCouponSchema }), controller.applyCoupon);
router.delete("/coupon", optionalAuth, controller.removeCoupon);

/**
 * @openapi
 * /cart/merge:
 *   post:
 *     tags: [Cart]
 *     summary: Merge a guest session cart into the logged-in user's cart (call right after login)
 *     security: [{ bearerAuth: [] }]
 */
router.post("/merge", requireAuth, controller.mergeGuestCart);

module.exports = router;
