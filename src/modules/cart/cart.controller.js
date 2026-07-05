const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const ApiError = require("../../utils/ApiError");
const service = require("./cart.service");

/**
 * Resolves which cart a request belongs to. Logged-in requests (req.user set
 * by optionalAuth) use their user id; guests must send an `x-session-id`
 * header (a client-generated UUID persisted in localStorage/AsyncStorage).
 */
function resolveIdentity(req) {
  if (req.user) return { userId: req.user.id };
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) {
    throw ApiError.badRequest("Guest requests must include an X-Session-Id header.");
  }
  return { sessionId };
}

const getCart = asyncHandler(async (req, res) => {
  const cart = await service.getCart(resolveIdentity(req));
  sendSuccess(res, { data: cart });
});

const addItem = asyncHandler(async (req, res) => {
  const cart = await service.addItem(resolveIdentity(req), req.body);
  sendSuccess(res, { data: cart, statusCode: 201 });
});

const updateItem = asyncHandler(async (req, res) => {
  const cart = await service.updateItem(resolveIdentity(req), req.params.itemId, req.body);
  sendSuccess(res, { data: cart });
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await service.removeItem(resolveIdentity(req), req.params.itemId);
  sendSuccess(res, { data: cart });
});

const applyCoupon = asyncHandler(async (req, res) => {
  const cart = await service.applyCoupon(resolveIdentity(req), req.body.code);
  sendSuccess(res, { data: cart });
});

const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await service.removeCoupon(resolveIdentity(req));
  sendSuccess(res, { data: cart });
});

const mergeGuestCart = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  await service.mergeGuestCart(req.user.id, req.body.sessionId);
  const cart = await service.getCart({ userId: req.user.id });
  sendSuccess(res, { data: cart });
});

module.exports = { getCart, addItem, updateItem, removeItem, applyCoupon, removeCoupon, mergeGuestCart };
