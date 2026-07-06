const { z } = require("zod");

const setUserStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

// Deliberately excludes "seller" (tied to store creation at signup) and "superadmin"
// (bootstrap-only, via the one-time seed.production.js env vars) — this endpoint only
// ever promotes a customer to admin staff, or demotes an admin back to a plain customer.
const setUserRoleSchema = z.object({
  role: z.enum(["customer", "admin"]),
});

const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(12, "Password must be at least 12 characters."),
});

const setStoreStatusSchema = z.object({
  status: z.enum(["pending", "approved", "suspended"]),
});

const setStoreCommissionSchema = z.object({
  commissionPercent: z.coerce.number().min(0).max(100).nullable(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  scope: z.string().optional(),
});

module.exports = {
  setUserStatusSchema,
  setUserRoleSchema,
  createAdminSchema,
  setStoreStatusSchema,
  setStoreCommissionSchema,
  listQuerySchema,
};
