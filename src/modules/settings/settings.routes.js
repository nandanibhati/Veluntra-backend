const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole, requirePermission } = require("../../middleware/auth");
const { updateSettingsSchema, restoreSettingsSchema } = require("./settings.validation");
const controller = require("./settings.controller");

const router = Router();

/**
 * @openapi
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Public storefront settings (branding, currency, tax rate, policies) — no secrets
 */
router.get("/", controller.getPublic);

/**
 * @openapi
 * /settings/admin:
 *   get:
 *     tags: [Settings]
 *     summary: Full settings for the admin dashboard (secrets masked)
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [Settings]
 *     summary: Update store settings — everything here is editable without a code change
 *     security: [{ bearerAuth: [] }]
 */
router.get("/admin", requireAuth, requireRole("admin"), requirePermission("settings.manage"), controller.getForAdmin);
router.patch(
  "/admin",
  requireAuth,
  requireRole("admin"),
  requirePermission("settings.manage"),
  validate({ body: updateSettingsSchema }),
  controller.update
);

/**
 * @openapi
 * /settings/admin/history:
 *   get:
 *     tags: [Settings]
 *     summary: Settings change audit history — who changed what, when, from where, and why (Super Admin only)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/admin/history", requireAuth, requireRole("superadmin"), controller.getAuditHistory);

/**
 * @openapi
 * /settings/admin/history/{logId}/restore:
 *   post:
 *     tags: [Settings]
 *     summary: Restore settings to a previous audit-log snapshot (secrets are never restored this way) — Super Admin only
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/admin/history/:logId/restore",
  requireAuth,
  requireRole("superadmin"),
  validate({ body: restoreSettingsSchema }),
  controller.restore
);

module.exports = router;
