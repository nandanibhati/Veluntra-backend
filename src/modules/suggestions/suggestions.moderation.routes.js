const { Router } = require("express");
const validate = require("../../middleware/validate");
const { setStatusSchema } = require("./suggestions.validation");
const controller = require("./suggestions.controller");

// Mounted under /admin/suggestions (auth + admin role already enforced by admin.routes.js).
const router = Router();

/**
 * @openapi
 * /admin/suggestions:
 *   get:
 *     tags: [Admin]
 *     summary: List customer suggestions/feedback (any status)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);
router.patch("/:id/status", validate({ body: setStatusSchema }), controller.setStatus);
router.delete("/:id", controller.remove);

module.exports = router;
