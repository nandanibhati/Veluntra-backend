const { z } = require("zod");

const createPartnerApplicationSchema = z.object({
  type: z.enum(["dropship", "wholesale", "affiliate"]),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(3).max(40),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  taxId: z.string().trim().max(100).optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().max(30).optional().or(z.literal("")),
  referralSource: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(2000),
});

const setStatusSchema = z.object({
  status: z.enum(["new", "reviewed", "approved", "rejected"]),
});

module.exports = { createPartnerApplicationSchema, setStatusSchema };
