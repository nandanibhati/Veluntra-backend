const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } = require("./categories.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const controller = require("./categories.controller");

const router = Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List all categories (public)
 *     responses:
 *       200: { description: List of categories }
 *   post:
 *     tags: [Categories]
 *     summary: Create a category (admin only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Category created }
 */
router.get("/", controller.list);
router.post("/", requireAuth, requireRole("admin"), validate({ body: createCategorySchema }), controller.create);

/**
 * @openapi
 * /categories/reorder:
 *   patch:
 *     tags: [Categories]
 *     summary: Bulk-set category display order (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/reorder",
  requireAuth,
  requireRole("admin"),
  validate({ body: reorderCategoriesSchema }),
  controller.reorder
);

/**
 * @openapi
 * /categories/{id}:
 *   patch:
 *     tags: [Categories]
 *     summary: Update a category (admin only)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a category (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate({ params: idParamSchema(), body: updateCategorySchema }),
  controller.update
);
router.delete("/:id", requireAuth, requireRole("admin"), validate({ params: idParamSchema() }), controller.remove);

module.exports = router;
