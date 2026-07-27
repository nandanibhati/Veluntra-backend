const { z } = require("zod");

const createAffiliateProfileSchema = z.object({
  userId: z.string().uuid(),
  referralCode: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, hyphens, and underscores.")
    .optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
});

const createCommissionSchema = z.object({
  description: z.string().trim().min(1).max(300),
  saleAmount: z.coerce.number().min(0),
  commissionAmount: z.coerce.number().min(0),
});

const setCommissionStatusSchema = z.object({
  status: z.enum(["pending", "approved", "paid"]),
});

module.exports = { createAffiliateProfileSchema, createCommissionSchema, setCommissionStatusSchema };
