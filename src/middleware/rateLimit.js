const rateLimit = require("express-rate-limit");

/** General API limiter — generous, just guards against runaway clients/bots. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Tighter limiter for auth endpoints — mitigates credential stuffing / brute force. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many attempts. Please try again later." } },
});

module.exports = { apiLimiter, authLimiter };
