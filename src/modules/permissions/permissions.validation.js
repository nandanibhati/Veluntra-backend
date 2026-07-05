const { z } = require("zod");
const { PERMISSION_KEYS, CONFIGURABLE_ROLES } = require("./permissions.constants");

const bulkSetPermissionsSchema = z.object({
  items: z
    .array(
      z.object({
        role: z.enum(CONFIGURABLE_ROLES),
        permission: z.enum(PERMISSION_KEYS),
        allowed: z.boolean(),
      })
    )
    .min(1),
  reason: z.string().trim().max(300).optional(),
});

module.exports = { bulkSetPermissionsSchema };
