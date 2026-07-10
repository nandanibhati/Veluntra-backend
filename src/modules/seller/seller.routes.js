const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { listQuerySchema } = require("../admin/admin.validation");
const { updateOrderStatusSchema } = require("../orders/orders.validation");
const { updateStoreBrandingSchema } = require("./seller.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const fulfillmentRequestsRouter = require("../fulfillmentRequests/fulfillmentRequests.routes");
const controller = require("./seller.controller");

const router = Router();
// "admin" is included because, while the platform only has one store, Admin/Super
// Admin are allowed to manage it from here too (see getStoreForOwner in seller.service.js).
router.use(requireAuth, requireRole("seller", "dropshipper", "admin"));

/**
 * @openapi
 * /seller/overview:
 *   get:
 *     tags: [Seller]
 *     summary: Store-scoped stats, revenue trend, and category sales for the logged-in seller
 *     security: [{ bearerAuth: [] }]
 */
router.get("/overview", controller.overview);

/**
 * @openapi
 * /seller/products:
 *   get:
 *     tags: [Seller]
 *     summary: List this seller's own products (any status, including drafts)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/products", validate({ query: listQuerySchema }), controller.listProducts);

/**
 * @openapi
 * /seller/orders:
 *   get:
 *     tags: [Seller]
 *     summary: List orders that contain this seller's products
 *     security: [{ bearerAuth: [] }]
 */
router.get("/orders", validate({ query: listQuerySchema }), controller.listOrders);

/**
 * @openapi
 * /seller/orders/{id}/status:
 *   patch:
 *     tags: [Seller]
 *     summary: Update the status/tracking of one of this seller's orders — cancelling/returning auto-restocks inventory
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/orders/:id/status",
  validate({ params: idParamSchema(), body: updateOrderStatusSchema }),
  controller.updateOrderStatus
);

/**
 * @openapi
 * /seller/customers:
 *   get:
 *     tags: [Seller]
 *     summary: Customers derived from this seller's order history
 *     security: [{ bearerAuth: [] }]
 */
router.get("/customers", controller.listCustomers);

/**
 * @openapi
 * /seller/store:
 *   get:
 *     tags: [Seller]
 *     summary: Get this seller's own store (including branding fields)
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [Seller]
 *     summary: Update this seller's own store branding (name, logo, address, contact info) — shown on customer-facing documents
 *     security: [{ bearerAuth: [] }]
 */
router.get("/store", controller.getStore);
router.patch("/store", validate({ body: updateStoreBrandingSchema }), controller.updateStoreBranding);

/**
 * @openapi
 * /seller/fulfillment-requests:
 *   post:
 *     tags: [Seller]
 *     summary: Request that Veluntra fulfill an order item from the warehouse
 *     security: [{ bearerAuth: [] }]
 */
router.use("/fulfillment-requests", fulfillmentRequestsRouter);

module.exports = router;
