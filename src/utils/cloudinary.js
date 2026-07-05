const { v2: cloudinary } = require("cloudinary");
const settingsService = require("../modules/settings/settings.service");

/** True once an admin has entered real Cloudinary credentials in Settings — checked per request,
 * so the feature turns on the moment credentials are saved, with no redeploy needed. */
async function isConfigured() {
  const settings = await settingsService.getRawForInternalUse();
  const config = settings.cloudinaryConfig;
  return Boolean(config?.cloudName && config?.apiKey && config?.apiSecret);
}

/** Uploads a single in-memory file buffer to Cloudinary, returning its public HTTPS URL. */
async function uploadBuffer(buffer, { folder = "veluntra" } = {}) {
  const settings = await settingsService.getRawForInternalUse();
  const config = settings.cloudinaryConfig;

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

module.exports = { isConfigured, uploadBuffer };
