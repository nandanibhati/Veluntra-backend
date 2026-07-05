const { Router } = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./reviews.service");

const router = Router();

/**
 * @openapi
 * /reviews/featured:
 *   get:
 *     tags: [Reviews]
 *     summary: Site-wide featured/top-rated approved reviews, for homepage testimonials
 */
router.get(
  "/featured",
  asyncHandler(async (req, res) => {
    const reviews = await service.listFeaturedSitewide(Number(req.query.limit) || 8);
    sendSuccess(res, { data: reviews });
  })
);

module.exports = router;
