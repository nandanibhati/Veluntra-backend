const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const uploadRoot = path.resolve(__dirname, "../../", env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    return cb(ApiError.badRequest("Only JPEG, PNG, WEBP, or GIF images are allowed"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
});

/** In-memory variant for images — used when we might forward the buffer to Cloudinary instead
 * of writing it to local disk (decided per-request, once we know whether Cloudinary is configured). */
const uploadImagesMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
});

/** Persists an in-memory file buffer to local disk (the non-Cloudinary fallback path). */
function saveBufferLocally(buffer, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(uploadRoot, filename), buffer);
  return publicUrlFor(filename);
}

/** Builds a public URL for an uploaded file, relative to this API's origin. */
function publicUrlFor(filename) {
  return `/uploads/${filename}`;
}

/** In-memory upload for CSV bulk import — we parse the buffer directly, no need to persist the file. */
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".csv") && file.mimetype !== "text/csv") {
      return cb(ApiError.badRequest("Only .csv files are accepted."));
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadCsv, uploadImagesMemory, uploadRoot, publicUrlFor, saveBufferLocally };
