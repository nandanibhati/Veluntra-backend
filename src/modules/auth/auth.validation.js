const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["customer", "seller", "dropshipper"]).optional().default("customer"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

module.exports = {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
};
