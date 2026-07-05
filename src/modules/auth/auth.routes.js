const { Router } = require("express");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { authLimiter } = require("../../middleware/rateLimit");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} = require("./auth.validation");
const controller = require("./auth.controller");

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new customer or seller account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [customer, seller] }
 *     responses:
 *       201: { description: Account created, tokens issued }
 */
router.post("/register", authLimiter, validate({ body: registerSchema }), controller.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email + password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Tokens issued }
 */
router.post("/login", authLimiter, validate({ body: loginSchema }), controller.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access/refresh token pair
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New tokens issued }
 */
router.post("/refresh", validate({ body: refreshSchema }), controller.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logged out }
 */
router.post("/logout", validate({ body: refreshSchema }), controller.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 */
router.get("/me", requireAuth, controller.me);

/**
 * @openapi
 * /auth/password/forgot:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 */
router.post(
  "/password/forgot",
  authLimiter,
  validate({ body: requestPasswordResetSchema }),
  controller.requestPasswordReset
);

/**
 * @openapi
 * /auth/password/reset:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using the token from the reset email
 */
router.post("/password/reset", authLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);

/**
 * @openapi
 * /auth/email/verify/request:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the email verification link
 *     security: [{ bearerAuth: [] }]
 */
router.post("/email/verify/request", requireAuth, controller.requestEmailVerification);

/**
 * @openapi
 * /auth/email/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify an email address using the token from the verification email
 */
router.post("/email/verify", validate({ body: verifyEmailSchema }), controller.verifyEmail);

module.exports = router;
