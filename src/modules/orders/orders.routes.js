const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, optionalAuth } = require("../../middleware/auth");
const { orderTrackLimiter } = require("../../middleware/rateLimit");
const { createOrderSchema, requestActionSchema, trackOrderSchema } = require("./orders.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const controller = require("./orders.controller");

const router = Router();

/**
 * @openapi
 * /orders/track:
 *   post:
 *     tags: [Orders]
 *     summary: Public order-status lookup by order number + email (no auth) — powers the storefront chatbot's "track my order" flow
 */
router.post("/track", orderTrackLimiter, validate({ body: trackOrderSchema }), controller.track);

/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List the current user's orders
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Orders]
 *     summary: >
 *       Place an order from the current cart (may create more than one order if the cart
 *       spans multiple stores). Works for logged-in users (saved shippingAddressId) and,
 *       when guest checkout is enabled in Settings, unauthenticated guests (X-Session-Id
 *       header + guestEmail/guestName/guestAddress in the body).
 *     parameters:
 *       - in: header
 *         name: X-Session-Id
 *         schema: { type: string }
 *         description: Required for guest checkout
 */
router.get("/", requireAuth, controller.list);
router.post("/", optionalAuth, validate({ body: createOrderSchema }), controller.create);

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get a single order belonging to the current user
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id", requireAuth, validate({ params: idParamSchema() }), controller.getById);

/**
 * @openapi
 * /orders/{id}/invoice:
 *   get:
 *     tags: [Orders]
 *     summary: Download a PDF invoice for an order
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id/invoice", requireAuth, validate({ params: idParamSchema() }), controller.invoice);

/**
 * @openapi
 * /orders/{id}/packing-slip:
 *   get:
 *     tags: [Orders]
 *     summary: Download a PDF packing slip for an order (no prices — internal fulfillment document)
 *     security: [{ bearerAuth: [] }]
 * /orders/{id}/shipping-label:
 *   get:
 *     tags: [Orders]
 *     summary: Download a PDF shipping label for an order
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id/packing-slip", requireAuth, validate({ params: idParamSchema() }), controller.packingSlip);
router.get("/:id/shipping-label", requireAuth, validate({ params: idParamSchema() }), controller.shippingLabel);

/**
 * @openapi
 * /orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Self-service cancellation (only within the admin-configured cancellation window)
 *     security: [{ bearerAuth: [] }]
 * /orders/{id}/return:
 *   post:
 *     tags: [Orders]
 *     summary: Request a return for a delivered order (only within the return window) — admin/seller approves or rejects
 *     security: [{ bearerAuth: [] }]
 * /orders/{id}/exchange:
 *   post:
 *     tags: [Orders]
 *     summary: Request an exchange for a delivered order (only within the exchange window) — admin/seller approves or rejects
 *     security: [{ bearerAuth: [] }]
 */
router.post("/:id/cancel", requireAuth, validate({ params: idParamSchema(), body: requestActionSchema }), controller.cancel);
router.post("/:id/return", requireAuth, validate({ params: idParamSchema(), body: requestActionSchema }), controller.requestReturn);
router.post("/:id/exchange", requireAuth, validate({ params: idParamSchema(), body: requestActionSchema }), controller.requestExchange);

module.exports = router;
