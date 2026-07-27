const { Router } = require("express");
const validate = require("../../middleware/validate");
const { setStatusSchema } = require("./partnerApplications.validation");
const { idParamSchema } = require("../../utils/commonSchemas");
const controller = require("./partnerApplications.controller");

// Mounted under /admin/partner-applications (auth + admin role already enforced by admin.routes.js).
const router = Router();

/**
 * @openapi
 * /admin/partner-applications:
 *   get:
 *     tags: [Admin]
 *     summary: List dropship/wholesale/affiliate partner applications (any status/type)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.patch("/:id/status", validate({ params: idParamSchema(), body: setStatusSchema }), controller.setStatus);
router.delete("/:id", validate({ params: idParamSchema() }), controller.remove);

module.exports = router;
