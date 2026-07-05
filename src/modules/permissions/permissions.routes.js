const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { bulkSetPermissionsSchema } = require("./permissions.validation");
const controller = require("./permissions.controller");

const router = Router();
router.use(requireAuth, requireRole("superadmin"));

/**
 * @openapi
 * /permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: Get the full role x permission grid (superadmin only)
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [Permissions]
 *     summary: Bulk-update role permissions (superadmin only)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.getGrid);
router.patch("/", validate({ body: bulkSetPermissionsSchema }), controller.bulkSet);

module.exports = router;
