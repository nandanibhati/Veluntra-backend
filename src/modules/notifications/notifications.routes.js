const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { registerDeviceSchema } = require("./notifications.validation");
const controller = require("./notifications.controller");

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.list);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/read-all", controller.markAllRead);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark one notification as read
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/:id/read", controller.markRead);

/**
 * @openapi
 * /notifications/register-device:
 *   post:
 *     tags: [Notifications]
 *     summary: Register a device push token (for future FCM/APNs delivery)
 *     security: [{ bearerAuth: [] }]
 */
router.post("/register-device", validate({ body: registerDeviceSchema }), controller.registerDevice);

module.exports = router;
