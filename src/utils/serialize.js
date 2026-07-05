const { Decimal } = require("@prisma/client/runtime/library");

/**
 * Recursively converts Prisma Decimal instances to plain numbers so every
 * API response is clean JSON (no client should ever have to parse a
 * Decimal-shaped string just to render a price).
 */
function toPlain(value) {
  if (value instanceof Decimal) return Number(value);
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = toPlain(val);
    }
    return out;
  }
  return value;
}

/** Strips sensitive fields from a User record before it ever reaches a response. */
function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, ...rest } = user;
  return toPlain(rest);
}

function generateOrderNumber() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `VNT-${random}`;
}

module.exports = { toPlain, sanitizeUser, generateOrderNumber };
