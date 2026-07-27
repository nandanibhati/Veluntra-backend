const { Router } = require("express");
const validate = require("../../middleware/validate");
const { idParamSchema } = require("../../utils/commonSchemas");
const {
  createAffiliateProfileSchema,
  createCommissionSchema,
  setCommissionStatusSchema,
} = require("./affiliates.validation");
const controller = require("./affiliates.controller");

// Mounted under /admin/affiliates (auth + admin role already enforced by admin.routes.js).
const router = Router();

/**
 * @openapi
 * /admin/affiliates:
 *   get:
 *     tags: [Admin]
 *     summary: List every affiliate profile with their commission totals
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Admin]
 *     summary: Create an affiliate profile for a user (after approving their partner application) — generates a referral code if none given
 *     security: [{ bearerAuth: [] }]
 */
router.get("/", controller.listProfiles);
router.post("/", validate({ body: createAffiliateProfileSchema }), controller.createProfile);

/**
 * @openapi
 * /admin/affiliates/{id}/commissions:
 *   post:
 *     tags: [Admin]
 *     summary: Manually record a commission entry for an affiliate
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/:id/commissions",
  validate({ params: idParamSchema(), body: createCommissionSchema }),
  controller.addCommission
);

/**
 * @openapi
 * /admin/affiliates/commissions/{commissionId}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a commission entry's status (pending/approved/paid)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  "/commissions/:commissionId/status",
  validate({ params: idParamSchema("commissionId"), body: setCommissionStatusSchema }),
  controller.setCommissionStatus
);

module.exports = router;
