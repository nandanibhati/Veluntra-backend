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

/** Guards the public suggestion box from spam — generous enough for a real user submitting a
 * few notes, tight enough to blunt a scripted flood. */
const suggestionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many suggestions submitted. Please try again later." } },
});

module.exports = { apiLimiter, authLimiter, suggestionLimiter };
