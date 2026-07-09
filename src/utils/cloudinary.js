const { v2: cloudinary } = require("cloudinary");
const settingsService = require("../modules/settings/settings.service");

/** True once an admin has entered real Cloudinary credentials in Settings — checked per request,
 * so the feature turns on the moment credentials are saved, with no redeploy needed. */
async function isConfigured() {
  const settings = await settingsService.getRawForInternalUse();
  const config = settings.cloudinaryConfig;
  return Boolean(config?.cloudName && config?.apiKey && config?.apiSecret);
}

/** Injects Cloudinary's auto-format/auto-quality/max-width transformation into a delivery URL —
 * without this, an uploaded photo is served at whatever resolution it was uploaded at (a phone
 * camera photo can easily be 4000px wide and several MB), regardless of how small it's actually
 * displayed on the page. Cloudinary applies this transformation on first request and caches the
 * result on its CDN, so this costs nothing extra at upload time. */
function optimizedUrl(secureUrl) {
  return secureUrl.replace("/upload/", "/upload/f_auto,q_auto,w_1600,c_limit/");
}

/** Uploads a single in-memory file buffer to Cloudinary, returning its public, size-optimized HTTPS URL. */
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
      resolve(optimizedUrl(result.secure_url));
    });
    stream.end(buffer);
  });
}

module.exports = { isConfigured, uploadBuffer };
