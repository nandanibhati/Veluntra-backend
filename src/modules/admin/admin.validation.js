const { z } = require("zod");

const setUserStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
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

module.exports = { setUserStatusSchema, setStoreStatusSchema, setStoreCommissionSchema, listQuerySchema };
