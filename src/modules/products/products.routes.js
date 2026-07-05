const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { uploadCsv } = require("../../middleware/upload");
const {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  bulkPriceUpdateSchema,
  bulkStockUpdateSchema,
  bulkStatusUpdateSchema,
  bulkCategoryUpdateSchema,
  bulkBrandUpdateSchema,
  bulkTagsUpdateSchema,
  bulkDeleteSchema,
  stockAdjustmentSchema,
} = require("./products.validation");
const controller = require("./products.controller");
const reviewsRouter = require("../reviews/reviews.routes");

const router = Router();

/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: List products (public) — supports filtering, sorting, and pagination
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: minRating
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [featured, price-asc, price-desc, rating, newest] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated product list }
 *   post:
 *     tags: [Products]
 *     summary: Create a product (seller — own store, or admin — any store). SKU and slug auto-generate if omitted.
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", validate({ query: listProductsQuerySchema }), controller.list);
router.post(
  "/",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: createProductSchema }),
  controller.create
);

/**
 * @openapi
 * /products/export:
 *   get:
 *     tags: [Products]
 *     summary: Export this seller's (or, for admin, any store's) products as CSV
 *     security: [{ bearerAuth: [] }]
 * /products/import:
 *   post:
 *     tags: [Products]
 *     summary: Bulk create/update products from a CSV file (matched by SKU)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 */
router.get("/export", requireAuth, requireRole("seller", "admin"), controller.exportCsv);
router.post("/import", requireAuth, requireRole("seller", "admin"), uploadCsv.single("file"), controller.importCsv);

/**
 * @openapi
 * /products/bulk/price:
 *   post:
 *     tags: [Products]
 *     summary: Bulk-update price for a set of products (own store, or any store for admin)
 *     security: [{ bearerAuth: [] }]
 * /products/bulk/stock:
 *   post:
 *     tags: [Products]
 *     summary: Bulk-update stock for a set of products
 *     security: [{ bearerAuth: [] }]
 * /products/bulk/status:
 *   post:
 *     tags: [Products]
 *     summary: Bulk-update status (active/draft) for a set of products
 *     security: [{ bearerAuth: [] }]
 * /products/bulk/delete:
 *   post:
 *     tags: [Products]
 *     summary: Bulk-delete a set of products
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/bulk/price",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkPriceUpdateSchema }),
  controller.bulkUpdatePrice
);
router.post(
  "/bulk/stock",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkStockUpdateSchema }),
  controller.bulkUpdateStock
);
router.post(
  "/bulk/status",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkStatusUpdateSchema }),
  controller.bulkUpdateStatus
);
router.post(
  "/bulk/delete",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkDeleteSchema }),
  controller.bulkDelete
);
router.post(
  "/bulk/category",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkCategoryUpdateSchema }),
  controller.bulkUpdateCategory
);
router.post(
  "/bulk/brand",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkBrandUpdateSchema }),
  controller.bulkUpdateBrand
);
router.post(
  "/bulk/tags",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: bulkTagsUpdateSchema }),
  controller.bulkUpdateTags
);

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a single product with images, options, variants, specs, and reviews
 *     responses:
 *       200: { description: Product detail }
 *   patch:
 *     tags: [Products]
 *     summary: Update a product (owning seller or admin)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product (owning seller or admin)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id", controller.getById);
router.patch(
  "/:id",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: updateProductSchema }),
  controller.update
);
router.delete("/:id", requireAuth, requireRole("seller", "admin"), controller.remove);

/**
 * @openapi
 * /products/{id}/manage:
 *   get:
 *     tags: [Products]
 *     summary: Full edit-form detail (cost price, reserved stock) for the owning seller or admin
 *     security: [{ bearerAuth: [] }]
 * /products/{id}/duplicate:
 *   post:
 *     tags: [Products]
 *     summary: Duplicate a product as a new draft (owning seller or admin)
 *     security: [{ bearerAuth: [] }]
 * /products/{id}/stock-adjustment:
 *   post:
 *     tags: [Products]
 *     summary: Manual, reason-tracked stock adjustment (damaged stock, recount, etc.) — signed delta
 *     security: [{ bearerAuth: [] }]
 * /products/{id}/inventory-history:
 *   get:
 *     tags: [Products]
 *     summary: Full stock-change audit trail for this product
 *     security: [{ bearerAuth: [] }]
 * /products/{id}/analytics:
 *   get:
 *     tags: [Products]
 *     summary: Per-product performance — views, sales, revenue, profit, conversion rate, wishlist/review counts, returns
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id/manage", requireAuth, requireRole("seller", "admin"), controller.getByIdForManage);
router.post("/:id/duplicate", requireAuth, requireRole("seller", "admin"), controller.duplicate);
router.post(
  "/:id/stock-adjustment",
  requireAuth,
  requireRole("seller", "admin"),
  validate({ body: stockAdjustmentSchema }),
  controller.adjustStock
);
router.get("/:id/inventory-history", requireAuth, requireRole("seller", "admin"), controller.inventoryHistory);
router.get("/:id/analytics", requireAuth, requireRole("seller", "admin"), controller.getAnalytics);

// Nested: /products/:productId/reviews
router.use("/:productId/reviews", reviewsRouter);

module.exports = router;
