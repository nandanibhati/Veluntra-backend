const { Router } = require("express");
const validate = require("../../middleware/validate");
const { optionalAuth } = require("../../middleware/auth");
const { partnerApplicationLimiter } = require("../../middleware/rateLimit");
const { createPartnerApplicationSchema } = require("./partnerApplications.validation");
const controller = require("./partnerApplications.controller");

const router = Router();

/**
 * @openapi
 * /partner-applications:
 *   post:
 *     tags: [PartnerApplications]
 *     summary: Apply for a dropship/wholesale/affiliate partner account — open to guests and logged-in shoppers
 */
router.post(
  "/",
  partnerApplicationLimiter,
  optionalAuth,
  validate({ body: createPartnerApplicationSchema }),
  controller.create
);

module.exports = router;
