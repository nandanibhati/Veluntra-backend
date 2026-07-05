const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const authService = require("./auth.service");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, { data: result, statusCode: 201 });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, { data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body);
  sendSuccess(res, { data: result });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body);
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
