const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole, requirePermission } = require("../../middleware/auth");
const { createSectionSchema, updateSectionSchema, reorderSectionsSchema, restoreSectionSchema } = require("./homepage.validation");
const controller = require("./homepage.controller");

const router = Router();

/**
 * @openapi
 * /homepage/sections:
 *   get:
 *     tags: [Homepage]
 *     summary: Enabled homepage sections in display order (public — what the storefront renders)
 */
router.get("/sections", controller.listPublic);

/**
 * @openapi
 * /homepage/admin/sections:
 *   get:
 *     tags: [Homepage]
 *     summary: All homepage sections including disabled ones (admin CMS editor)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Homepage]
 *     summary: Add a homepage section
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  "/admin/sections",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  controller.listAll
);
router.post(
  "/admin/sections",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  validate({ body: createSectionSchema }),
  controller.create
);

/**
 * @openapi
 * /homepage/admin/sections/reorder:
 *   patch:
 *     tags: [Homepage]
 *     summary: Bulk-set homepage section display order (drag-and-drop reorder)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/admin/sections/reorder",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  validate({ body: reorderSectionsSchema }),
  controller.reorder
);

/**
 * @openapi
 * /homepage/admin/sections/{id}:
 *   patch:
 *     tags: [Homepage]
 *     summary: Update a homepage section (title, config, enabled)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Homepage]
 *     summary: Remove a homepage section
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/admin/sections/:id",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  validate({ body: updateSectionSchema }),
  controller.update
);
router.delete(
  "/admin/sections/:id",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  controller.remove
);

/**
 * @openapi
 * /homepage/admin/history:
 *   get:
 *     tags: [Homepage]
 *     summary: Homepage section change history — every add/edit/remove/reorder
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  "/admin/history",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  controller.getHistory
);

/**
 * @openapi
 * /homepage/admin/history/{logId}/restore:
 *   post:
 *     tags: [Homepage]
 *     summary: Restore a homepage section to a previous history snapshot
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/admin/history/:logId/restore",
  requireAuth,
  requireRole("admin"),
  requirePermission("homepage.manage"),
  validate({ body: restoreSectionSchema }),
  controller.restore
);

module.exports = router;
