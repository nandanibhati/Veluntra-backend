require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

// Secrets that must never reach production — either literal placeholders from docker-compose's
// dev-time fallbacks, or anything obviously short/guessable. Catches "it booted with the sample
// value" before it catches a real breach.
const KNOWN_INSECURE_SECRETS = new Set([
  "change-me-access-secret",
  "change-me-refresh-secret",
  "changeme",
  "secret",
  "password",
]);

function assertSecureSecret(name, value) {
  if (!isProduction) return;
  if (KNOWN_INSECURE_SECRETS.has(value) || value.length < 32) {
    throw new Error(
      `${name} is missing or too weak for production (must be a random string of at least 32 characters, ` +
        `and must not be a known placeholder). Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
}

const jwtAccessSecret = required("JWT_ACCESS_SECRET");
const jwtRefreshSecret = required("JWT_REFRESH_SECRET");
assertSecureSecret("JWT_ACCESS_SECRET", jwtAccessSecret);
assertSecureSecret("JWT_REFRESH_SECRET", jwtRefreshSecret);
if (isProduction && jwtAccessSecret === jwtRefreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values in production.");
}

// In production there is no sane default CORS origin — an unset value would either lock out the
// real frontend or (worse) someone "fixes" it by wildcarding. Force it to be named explicitly.
if (isProduction && !process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS must be set explicitly in production (no default is safe to fall back to).");
}

// A production DATABASE_URL pointing at the well-known dev credentials means the dev docker-compose
// was deployed as-is — fail loudly rather than run a production app against a guessable database.
const databaseUrl = required("DATABASE_URL");
if (isProduction && /Veluntra:Veluntra@/i.test(databaseUrl)) {
  throw new Error("DATABASE_URL still uses the development default credentials (Veluntra/Veluntra) — set real production credentials.");
}

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 4000,
  databaseUrl,
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB) || 5,
  allowDevSeed: process.env.ALLOW_DEV_SEED === "true" || !isProduction,
  // Used to build Stripe's success_url/cancel_url — where the customer lands after paying.
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  // Optional — card payment is simply unavailable (storefront falls back to COD-only) until
  // these are set. Never required at boot, unlike the JWT secrets above: a store should be
  // able to launch and take COD orders before its owner has finished Stripe onboarding.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  },
};

module.exports = env;
