const { z } = require("zod");

const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android", "web"]),
});

module.exports = { registerDeviceSchema };
