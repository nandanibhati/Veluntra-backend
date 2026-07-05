const { Router } = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./stats.service");

const router = Router();

/**
 * @openapi
 * /stats:
 *   get:
 *     tags: [Stats]
 *     summary: Public platform stats for the homepage (happy customers, products delivered, countries served, average rating)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const stats = await service.getPublicStats();
    sendSuccess(res, { data: stats });
  })
);

module.exports = router;
