const prisma = require("../../config/db");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const ApiError = require("../../utils/ApiError");
const env = require("../../config/env");

const SECRET_KEYS = ["smtpConfig", "paymentGatewayConfig", "cloudinaryConfig"];

const DEFAULT_ANIMATION_CONFIG = {
  preset: "modern",
  speed: "normal",
  duration: 0.5,
  intensity: "normal",
  hover: "lift",
  idle: "float",
  shadow: "medium",
  glow: true,
  borderRadius: "rounded",
  cardStyle: "elevated",
  delay: 0.05,
  loop: true,
};

const DEFAULT_FEATURE_FLAGS = {
  wishlist: true,
  reviews: true,
  coupons: true,
  flashSale: true,
  cod: true,
  loyaltyPoints: true,
  referrals: true,
  guestCheckout: true,
  sellerCoupons: true,
  emailNotifications: true,
  pushNotifications: true,
  cookieConsent: true,
};

const DEFAULT_POPUP_BANNER = {
  enabled: false,
  title: "",
  body: "",
  imageUrl: null,
  ctaText: "",
  ctaLink: "",
};

const DEFAULT_VIP_TIERS = {
  enabled: false,
  silverThreshold: 100,
  goldThreshold: 500,
  platinumThreshold: 1000,
};

/** Given a customer's lifetime spend, returns which tier (if any) they qualify for —
 * highest tier wins. Returns null when tiers are disabled or spend doesn't reach silver. */
function resolveTierForSpend(vipTiers, lifetimeSpend) {
  if (!vipTiers.enabled) return null;
  const spend = Number(lifetimeSpend);
  if (spend >= Number(vipTiers.platinumThreshold)) return "platinum";
  if (spend >= Number(vipTiers.goldThreshold)) return "gold";
  if (spend >= Number(vipTiers.silverThreshold)) return "silver";
  return null;
}

/** Ensures the single settings row exists (id=1), creating it with defaults on first read. */
async function getOrCreate() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.settings.create({ data: { id: 1 } });
  return settings;
}

function maskSecrets(settings) {
  const plain = toPlain(settings);
  for (const key of SECRET_KEYS) {
    if (plain[key] && typeof plain[key] === "object") {
      const masked = {};
      for (const k of Object.keys(plain[key])) masked[k] = "••••••••";
      plain[key] = masked;
    }
  }
  return plain;
}

/** Merges stored overrides over the defaults so a never-configured flag still reads as "on". */
function resolveFeatureFlags(settings) {
  return { ...DEFAULT_FEATURE_FLAGS, ...(settings.featureFlags || {}) };
}

/** Merges stored overrides over the defaults so a never-configured animation field still reads as sane. */
function resolveAnimationConfig(settings) {
  return { ...DEFAULT_ANIMATION_CONFIG, ...(settings.animationConfig || {}) };
}

/** Merges stored overrides over the defaults so a never-configured popup field still reads as sane. */
function resolvePopupBanner(settings) {
  return { ...DEFAULT_POPUP_BANNER, ...(settings.popupBanner || {}) };
}

/** Merges stored overrides over the defaults so never-configured VIP thresholds still read as sane. */
function resolveVipTiers(settings) {
  return { ...DEFAULT_VIP_TIERS, ...(settings.vipTiers || {}) };
}

/** Convenience for other modules: `if (!(await isFeatureEnabled('cod'))) throw ...` */
async function isFeatureEnabled(flag) {
  const settings = await getOrCreate();
  return resolveFeatureFlags(settings)[flag] !== false;
}

/** Public-facing settings (storefront needs currency/tax/business rules/branding, but never secrets). */
async function getPublic() {
  const settings = await getOrCreate();
  const plain = toPlain(settings);
  return {
    storeName: plain.storeName,
    logoUrl: plain.logoUrl,
    bannerUrl: plain.bannerUrl,
    themeColors: plain.themeColors,
    currency: plain.currency,
    currencySymbol: plain.currencySymbol,
    taxPercent: plain.taxPercent,
    defaultShippingCost: plain.defaultShippingCost,
    freeShippingThreshold: plain.freeShippingThreshold,
    codCharge: plain.codCharge,
    minOrderValue: plain.minOrderValue,
    returnWindowDays: plain.returnWindowDays,
    exchangeWindowDays: plain.exchangeWindowDays,
    cancellationWindowHours: plain.cancellationWindowHours,
    referralBonusAmount: plain.referralBonusAmount,
    contactEmail: plain.contactEmail,
    contactPhone: plain.contactPhone,
    contactAddress: plain.contactAddress,
    socialLinks: plain.socialLinks,
    returnPolicy: plain.returnPolicy,
    privacyPolicy: plain.privacyPolicy,
    termsOfService: plain.termsOfService,
    featureFlags: resolveFeatureFlags(plain),
    animationConfig: resolveAnimationConfig(plain),
    popupBanner: resolvePopupBanner(plain),
    vipTiers: resolveVipTiers(plain),
    stripeEnabled: Boolean(env.stripe.secretKey),
  };
}

/** Admin view — secrets are masked; use getRawForInternalUse() for actually sending email/charging cards. */
async function getForAdmin() {
  const settings = await getOrCreate();
  return {
    ...maskSecrets(settings),
    featureFlags: resolveFeatureFlags(settings),
    animationConfig: resolveAnimationConfig(settings),
    popupBanner: resolvePopupBanner(settings),
    vipTiers: resolveVipTiers(settings),
  };
}

/** Never expose this over an API response — for internal service use only (e.g. the mailer). */
async function getRawForInternalUse() {
  return getOrCreate();
}

async function update(data, actorId, { ipAddress, reason } = {}) {
  const before = await getOrCreate();

  // `reason` is metadata for the audit log, not a settings column.
  const { reason: _ignored, ...rest } = data;
  const sanitized = { ...rest };

  // If a secret field arrives as all-masked bullets (i.e. admin didn't change it), drop it
  // from the update so we don't overwrite real credentials with placeholder dots.
  for (const key of SECRET_KEYS) {
    const incoming = sanitized[key];
    if (incoming && typeof incoming === "object") {
      const allMasked = Object.values(incoming).every((v) => v === "••••••••");
      if (allMasked) delete sanitized[key];
    }
  }

  // Feature flags are merged (not replaced), so a partial update doesn't silently disable
  // every other flag.
  if (sanitized.featureFlags) {
    sanitized.featureFlags = { ...resolveFeatureFlags(before), ...sanitized.featureFlags };
  }
  if (sanitized.animationConfig) {
    sanitized.animationConfig = { ...resolveAnimationConfig(before), ...sanitized.animationConfig };
  }
  if (sanitized.popupBanner) {
    sanitized.popupBanner = { ...resolvePopupBanner(before), ...sanitized.popupBanner };
  }
  if (sanitized.vipTiers) {
    sanitized.vipTiers = { ...resolveVipTiers(before), ...sanitized.vipTiers };
  }

  const updated = await prisma.settings.update({ where: { id: 1 }, data: sanitized });

  await prisma.activityLog.create({
    data: {
      actorId,
      action: "Updated store settings",
      scope: "settings",
      entityType: "Settings",
      entityId: "1",
      previousValue: maskSecrets(before),
      newValue: maskSecrets(updated),
      reason: reason || null,
      ipAddress: ipAddress || null,
    },
  });

  return {
    ...maskSecrets(updated),
    featureFlags: resolveFeatureFlags(updated),
    animationConfig: resolveAnimationConfig(updated),
    popupBanner: resolvePopupBanner(updated),
    vipTiers: resolveVipTiers(updated),
  };
}

/** Audit trail of every settings change — for the Super Admin "Settings history" screen. */
async function getAuditHistory(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = { scope: "settings", entityType: "Settings" };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return {
    items: items.map((l) => toPlain({ ...l, actorName: l.actor?.name || "System", actor: undefined })),
    page,
    limit,
    total,
  };
}

/**
 * Restores settings to a previous audit-log snapshot. Secret fields are never restored from a
 * log entry (they're stored masked there), so credentials already configured now are left alone.
 */
async function restoreFromLog(logId, actorId, { ipAddress, reason } = {}) {
  const log = await prisma.activityLog.findUnique({ where: { id: logId } });
  if (!log || log.scope !== "settings" || !log.previousValue) {
    throw ApiError.badRequest("This history entry cannot be restored.");
  }

  const snapshot = { ...log.previousValue };
  for (const key of SECRET_KEYS) delete snapshot[key];
  delete snapshot.id;
  delete snapshot.updatedAt;

  return update(snapshot, actorId, { ipAddress, reason: reason || `Restored from history entry ${logId}` });
}

module.exports = {
  getOrCreate,
  getPublic,
  getForAdmin,
  getRawForInternalUse,
  update,
  getAuditHistory,
  restoreFromLog,
  isFeatureEnabled,
  resolveFeatureFlags,
  resolveAnimationConfig,
  resolveVipTiers,
  resolveTierForSpend,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_VIP_TIERS,
};
