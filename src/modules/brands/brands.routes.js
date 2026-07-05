const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createBrandSchema, updateBrandSchema, reorderBrandsSchema } = require("./brands.validation");
const controller = require("./brands.controller");

const router = Router();

/**
 * @openapi
 * /brands:
 *   get:
 *     tags: [Brands]
 *     summary: List all brands (public)
 *     responses:
 *       200: { description: List of brands }
 *   post:
 *     tags: [Brands]
 *     summary: Create a brand (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.post("/", requireAuth, requireRole("admin"), validate({ body: createBrandSchema }), controller.create);

/**
 * @openapi
 * /brands/reorder:
 *   patch:
 *     tags: [Brands]
 *     summary: Bulk-set brand display order (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/reorder",
  requireAuth,
  requireRole("admin"),
  validate({ body: reorderBrandsSchema }),
  controller.reorder
);

/**
 * @openapi
 * /brands/{id}:
 *   patch:
 *     tags: [Brands]
 *     summary: Update a brand (admin only)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Brands]
 *     summary: Delete a brand (admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/:id", requireAuth, requireRole("admin"), validate({ body: updateBrandSchema }), controller.update);
router.delete("/:id", requireAuth, requireRole("admin"), controller.remove);

module.exports = router;
