const { z } = require("zod");

const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  themeColors: z.record(z.string(), z.string()).optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  currencySymbol: z.string().trim().min(1).max(3).optional(),

  taxPercent: z.coerce.number().min(0).max(100).optional(),
  platformCommissionPercent: z.coerce.number().min(0).max(100).optional(),
  defaultShippingCost: z.coerce.number().min(0).optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional().nullable(),
  codCharge: z.coerce.number().min(0).optional(),
  minOrderValue: z.coerce.number().min(0).optional(),
  returnWindowDays: z.coerce.number().int().min(0).optional(),
  exchangeWindowDays: z.coerce.number().int().min(0).optional(),
  cancellationWindowHours: z.coerce.number().int().min(0).optional(),
  orderStatusNotify: z.record(z.string(), z.boolean()).optional().nullable(),
  loyaltyPointsPerUnit: z.coerce.number().min(0).optional(),
  referralBonusAmount: z.coerce.number().min(0).optional(),
  allowSellerCoupons: z.coerce.boolean().optional(),

  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(30).optional().nullable(),
  contactAddress: z.string().max(300).optional().nullable(),
  socialLinks: z.record(z.string(), z.string()).optional().nullable(),
  returnPolicy: z.string().optional().nullable(),
  privacyPolicy: z.string().optional().nullable(),
  termsOfService: z.string().optional().nullable(),

  featureFlags: z
    .object({
      wishlist: z.boolean(),
      reviews: z.boolean(),
      coupons: z.boolean(),
      flashSale: z.boolean(),
      cod: z.boolean(),
      loyaltyPoints: z.boolean(),
      referrals: z.boolean(),
      guestCheckout: z.boolean(),
      sellerCoupons: z.boolean(),
      emailNotifications: z.boolean(),
      pushNotifications: z.boolean(),
      cookieConsent: z.boolean(),
    })
    .partial()
    .optional()
    .nullable(),

  smtpConfig: z
    .object({
      host: z.string(),
      port: z.coerce.number(),
      secure: z.coerce.boolean().default(true),
      user: z.string(),
      pass: z.string(),
      fromEmail: z.string().email(),
    })
    .partial()
    .optional()
    .nullable(),
  paymentGatewayConfig: z.record(z.string(), z.string()).optional().nullable(),
  cloudinaryConfig: z
    .object({ cloudName: z.string(), apiKey: z.string(), apiSecret: z.string() })
    .partial()
    .optional()
    .nullable(),
  notificationConfig: z.record(z.string(), z.boolean()).optional().nullable(),

  animationConfig: z
    .object({
      preset: z.enum([
        "apple",
        "nike",
        "samsung",
        "luxury",
        "minimal",
        "gaming",
        "glass",
        "neon",
        "modern",
        "corporate",
      ]),
      speed: z.enum(["slow", "normal", "fast"]),
      duration: z.coerce.number().min(0.1).max(3),
      intensity: z.enum(["subtle", "normal", "strong"]),
      hover: z.enum(["lift", "tilt", "zoom", "glow", "none"]),
      idle: z.enum(["float", "breathe", "pulse", "none"]),
      shadow: z.enum(["none", "soft", "medium", "strong"]),
      glow: z.coerce.boolean(),
      borderRadius: z.enum(["sharp", "soft", "rounded", "pill"]),
      cardStyle: z.enum(["flat", "elevated", "glass", "bordered"]),
      delay: z.coerce.number().min(0).max(1),
      loop: z.coerce.boolean(),
    })
    .partial()
    .optional()
    .nullable(),

  popupBanner: z
    .object({
      enabled: z.boolean(),
      title: z.string().trim().max(160),
      body: z.string().trim().max(1000),
      imageUrl: z.string().url().nullable(),
      ctaText: z.string().trim().max(60),
      ctaLink: z.string().trim().max(300),
    })
    .partial()
    .optional()
    .nullable(),

  // Audit metadata only — not a stored settings column.
  reason: z.string().trim().max(300).optional(),
});

const restoreSettingsSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

module.exports = { updateSettingsSchema, restoreSettingsSchema };
