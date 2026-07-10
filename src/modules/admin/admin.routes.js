const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const {
  setUserStatusSchema,
  setUserRoleSchema,
  createAdminSchema,
  setStoreStatusSchema,
  setStoreCommissionSchema,
  listQuerySchema,
  adjustWarehouseStockSchema,
} = require("./admin.validation");
const { updateOrderStatusSchema, assignSellerSchema } = require("../orders/orders.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const reviewsModerationRouter = require("../reviews/reviews.moderation.routes");
const suggestionsModerationRouter = require("../suggestions/suggestions.moderation.routes");
const controller = require("./admin.controller");

const router = Router();
router.use(requireAuth, requireRole("admin"));

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users on the platform
 *     security: [{ bearerAuth: [] }]
 */
router.get("/users", validate({ query: listQuerySchema }), controller.listUsers);

/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Full customer detail — orders, wishlist, addresses, coupons used, total spent, reward points
 *     security: [{ bearerAuth: [] }]
 */
router.get("/users/:id", validate({ params: idParamSchema() }), controller.getCustomerDetail);

/**
 * @openapi
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspend or reactivate a user
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/users/:id/status", validate({ params: idParamSchema(), body: setUserStatusSchema }), controller.setUserStatus);
router.delete("/users/:id", validate({ params: idParamSchema() }), controller.deleteUser);

/**
 * @openapi
 * /admin/users/admins:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new Admin staff account directly (Super Admin only — there's no self-signup path for this role)
 *     security: [{ bearerAuth: [] }]
 * /admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Promote a customer to Admin, or demote an Admin back to customer (Super Admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.post("/users/admins", requireRole("superadmin"), validate({ body: createAdminSchema }), controller.createAdmin);
router.patch(
  "/users/:id/role",
  requireRole("superadmin"),
  validate({ params: idParamSchema(), body: setUserRoleSchema }),
  controller.setUserRole
);

/**
 * @openapi
 * /admin/users/{id}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Trigger a password reset email for a user (admin-initiated)
 *     security: [{ bearerAuth: [] }]
 */
router.post("/users/:id/reset-password", validate({ params: idParamSchema() }), controller.resetUserPassword);

/**
 * @openapi
 * /admin/sellers:
 *   get:
 *     tags: [Admin]
 *     summary: List all seller stores with owner info and stats
 *     security: [{ bearerAuth: [] }]
 */
router.get("/sellers", validate({ query: listQuerySchema }), controller.listStores);

/**
 * @openapi
 * /admin/sellers/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve or suspend a seller's store
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/sellers/:id/status", validate({ params: idParamSchema(), body: setStoreStatusSchema }), controller.setStoreStatus);

/**
 * @openapi
 * /admin/sellers/{id}/commission:
 *   patch:
 *     tags: [Admin]
 *     summary: Set a seller's commission percentage (null = use platform default)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/sellers/:id/commission",
  validate({ params: idParamSchema(), body: setStoreCommissionSchema }),
  controller.setStoreCommission
);

/**
 * @openapi
 * /admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: List all orders across every store
 *     security: [{ bearerAuth: [] }]
 */
router.get("/orders", validate({ query: listQuerySchema }), controller.listOrders);

/**
 * @openapi
 * /admin/orders/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update an order's status/payment/tracking (any store) — cancelling/returning auto-restocks inventory
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/orders/:id/status",
  validate({ params: idParamSchema(), body: updateOrderStatusSchema }),
  controller.updateOrderStatus
);

/**
 * @openapi
 * /admin/orders/{id}/assign-seller:
 *   patch:
 *     tags: [Admin]
 *     summary: Reassign an order to a different store/seller
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/orders/:id/assign-seller",
  validate({ params: idParamSchema(), body: assignSellerSchema }),
  controller.assignSeller
);

/**
 * @openapi
 * /admin/orders/{id}/invoice:
 *   get:
 *     tags: [Admin]
 *     summary: Download the PDF invoice for any order
 *     security: [{ bearerAuth: [] }]
 */
router.get("/orders/:id/invoice", validate({ params: idParamSchema() }), controller.orderInvoice);

/**
 * @openapi
 * /admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: List all products across every store
 *     security: [{ bearerAuth: [] }]
 */
router.get("/products", validate({ query: listQuerySchema }), controller.listProducts);

/**
 * @openapi
 * /admin/activity-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Platform-wide activity/audit log
 *     security: [{ bearerAuth: [] }]
 */
router.get("/activity-logs", validate({ query: listQuerySchema }), controller.listActivityLogs);

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     tags: [Admin]
 *     summary: Revenue trend, orders by category, payment split, and customer trend
 *     security: [{ bearerAuth: [] }]
 */
router.get("/analytics", controller.analytics);

/**
 * @openapi
 * /admin/dashboard-summary:
 *   get:
 *     tags: [Admin]
 *     summary: Everything the admin Dashboard home page needs in one call — headline stats, orders needing action, low/out-of-stock products, recent orders
 *     security: [{ bearerAuth: [] }]
 */
router.get("/dashboard-summary", controller.dashboardSummary);

/**
 * @openapi
 * /admin/reviews:
 *   get:
 *     tags: [Admin]
 *     summary: Review moderation — approve/reject/delete/feature/reply
 *     security: [{ bearerAuth: [] }]
 */
router.use("/reviews", reviewsModerationRouter);

/**
 * @openapi
 * /admin/suggestions:
 *   get:
 *     tags: [Admin]
 *     summary: Customer suggestion box — list/moderate feedback
 *     security: [{ bearerAuth: [] }]
 */
router.use("/suggestions", suggestionsModerationRouter);

/**
 * @openapi
 * /admin/warehouse-stock:
 *   get:
 *     tags: [Admin]
 *     summary: List warehouse stock levels, optionally searched by product name
 *     security: [{ bearerAuth: [] }]
 * /admin/warehouse-stock/{productId}/adjust:
 *   post:
 *     tags: [Admin]
 *     summary: Provision or correct warehouse stock for a product/variant (signed delta, logged)
 *     security: [{ bearerAuth: [] }]
 * /admin/warehouse-stock/{productId}/history:
 *   get:
 *     tags: [Admin]
 *     summary: Recent warehouse stock transactions for a product/variant
 *     security: [{ bearerAuth: [] }]
 */
router.get("/warehouse-stock", controller.listWarehouseStock);
router.post(
  "/warehouse-stock/:productId/adjust",
  validate({ params: idParamSchema("productId"), body: adjustWarehouseStockSchema }),
  controller.adjustWarehouseStock
);
router.get("/warehouse-stock/:productId/history", validate({ params: idParamSchema("productId") }), controller.warehouseStockHistory);

module.exports = router;
