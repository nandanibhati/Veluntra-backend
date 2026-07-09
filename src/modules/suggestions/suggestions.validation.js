const { z } = require("zod");

const createSuggestionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  message: z.string().trim().min(5).max(2000),
});

const setStatusSchema = z.object({
  status: z.enum(["new", "reviewed", "archived"]),
});

module.exports = { createSuggestionSchema, setStatusSchema };
