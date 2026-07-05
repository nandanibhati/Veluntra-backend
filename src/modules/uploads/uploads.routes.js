const { Router } = require("express");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { uploadImagesMemory, saveBufferLocally } = require("../../middleware/upload");
const cloudinaryUtil = require("../../utils/cloudinary");
const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const ApiError = require("../../utils/ApiError");

const router = Router();

/**
 * @openapi
 * /uploads/images:
 *   post:
 *     tags: [Uploads]
 *     summary: >
 *       Upload one or more images (product photos, avatars) — returns public URLs.
 *       Stored in Cloudinary if an admin has configured credentials in Settings,
 *       otherwise served from local disk (works out of the box, no setup required).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 */
router.post(
  "/images",
  requireAuth,
  requireRole("seller", "admin"),
  uploadImagesMemory.array("files", 8),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) throw ApiError.badRequest("No files uploaded.");

    const useCloudinary = await cloudinaryUtil.isConfigured();
    const urls = await Promise.all(
      req.files.map((file) =>
        useCloudinary ? cloudinaryUtil.uploadBuffer(file.buffer) : saveBufferLocally(file.buffer, file.originalname)
      )
    );

    sendSuccess(res, { data: { urls, storage: useCloudinary ? "cloudinary" : "local" }, statusCode: 201 });
  })
);

module.exports = router;
