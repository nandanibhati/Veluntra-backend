const { Router } = require("express");
const { requireAuth } = require("../../middleware/auth");
const controller = require("./affiliates.controller");

const router = Router();

/**
 * @openapi
 * /affiliates/me:
 *   get:
 *     tags: [Affiliates]
 *     summary: The current user's own affiliate profile (referral code, commission rate, commission history) — null if they don't have one
 *     security: [{ bearerAuth: [] }]
 */
router.get("/me", requireAuth, controller.getMyProfile);

module.exports = router;
