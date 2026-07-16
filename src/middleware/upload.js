const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const uploadRoot = path.resolve(__dirname, "../../", env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

// Extension is always derived from this whitelist — NEVER from the client-supplied
// originalname/mimetype directly — so a file can't be persisted (and later served by
// express.static, which sets Content-Type from the extension) as .html/.svg/.js no matter
// what an attacker names the upload or spoofs the multipart Content-Type header to.
const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const ALLOWED_TYPES = new Set(Object.keys(MIME_TO_EXT));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    cb(null, `${randomUUID()}${MIME_TO_EXT[file.mimetype]}`);
  },
});

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

/** Persists an in-memory file buffer to local disk (the non-Cloudinary fallback path). Extension
 * comes from the already-validated mimetype (see MIME_TO_EXT above), never from the client-
 * supplied originalname. */
function saveBufferLocally(buffer, mimetype) {
  const ext = MIME_TO_EXT[mimetype];
  if (!ext) throw ApiError.badRequest("Only JPEG, PNG, WEBP, or GIF images are allowed");
  const filename = `${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(uploadRoot, filename), buffer);
  return publicUrlFor(filename);
}

/** Builds a public URL for an uploaded file, relative to this API's origin. */
function publicUrlFor(filename) {
  return `/uploads/${filename}`;
}

/** In-memory upload for bulk product import — we parse the buffer directly, no need to persist
 * the file. Accepts .csv or .xlsx (the common "just export from Excel" case). */
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      return cb(ApiError.badRequest("Only .csv or .xlsx files are accepted."));
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadCsv, uploadImagesMemory, uploadRoot, publicUrlFor, saveBufferLocally };
