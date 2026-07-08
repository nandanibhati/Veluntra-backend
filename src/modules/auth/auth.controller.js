const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const { durationToMs } = require("../../utils/jwt");
const env = require("../../config/env");
const authService = require("./auth.service");

const REFRESH_COOKIE_NAME = "refreshToken";

// Cross-site in production (the SPA and API live on different domains — Vercel/Render), so the
// cookie needs SameSite=None + Secure to be sent on cross-origin XHR at all. In local dev the
// frontend/backend are same-site (just different localhost ports), where Lax already works and
// Secure would require HTTPS we don't have locally.
function refreshCookieOptions() {
  const isProd = env.nodeEnv === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/v1/auth",
    maxAge: durationToMs(env.jwt.refreshExpiresIn),
  };
}

/** Moves refreshToken out of the JSON body and into an httpOnly cookie — never readable by JS,
 * so an XSS payload can't exfiltrate it the way it could with a body-returned token. */
function setRefreshCookieAndStrip(res, result) {
  const { refreshToken, ...rest } = result;
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return rest;
}

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, { data: setRefreshCookieAndStrip(res, result), statusCode: 201 });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, { data: setRefreshCookieAndStrip(res, result) });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ success: false, error: { message: "No refresh token found." } });
  }
  const result = await authService.refresh({ refreshToken });
  sendSuccess(res, { data: setRefreshCookieAndStrip(res, result) });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) await authService.logout({ refreshToken });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/v1/auth" });
  sendSuccess(res, { data: { loggedOut: true } });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  sendSuccess(res, { data: user });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  sendSuccess(res, { data: result });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.newPassword);
  sendSuccess(res, { data: result });
});

const requestEmailVerification = asyncHandler(async (req, res) => {
  const result = await authService.requestEmailVerification(req.user.id);
  sendSuccess(res, { data: result });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body.token);
  sendSuccess(res, { data: result });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
};
