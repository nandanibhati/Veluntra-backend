const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const ApiError = require("../../utils/ApiError");
const { streamInvoice } = require("../../utils/invoice");
const prisma = require("../../config/db");
const settingsService = require("../settings/settings.service");
const authService = require("../auth/auth.service");
const cartService = require("../cart/cart.service");
const paymentsService = require("../payments/payments.service");
const service = require("./orders.service");

/** Card orders need a Stripe Checkout session to redirect the customer to; "demo_card" orders
 * are marked paid immediately with no real gateway involved (demo/test mode only); COD orders
 * need neither. Shared by both the logged-in and guest checkout branches below. Must be called
 * AFTER verifyPaymentMethodAvailable() has already confirmed the method is actually available,
 * so this never fails once an order (and its stock decrement) already exists. */
async function buildResponse(orders, paymentMethod, settings) {
  if (paymentMethod === "card") {
    const session = await paymentsService.createCheckoutSession(orders, { currency: settings.currency });
    return { orders, checkoutUrl: session.url };
  }
  if (paymentMethod === "demo_card") {
    await service.markPaid(orders.map((o) => o.id));
    return { orders: orders.map((o) => ({ ...o, paymentStatus: "paid" })), checkoutUrl: null };
  }
  return { orders, checkoutUrl: null };
}

/** Rejects payment methods that aren't actually available before any order/stock-decrement
 * happens, so a store with no Stripe keys configured never leaves behind an unpayable "ghost"
 * order, and demo_card can't be used by real customers unless the store owner switched it on. */
function verifyPaymentMethodAvailable(paymentMethod, settings) {
  if (paymentMethod === "card" && !paymentsService.isStripeEnabled()) {
    throw ApiError.badRequest("Card payment isn't set up for this store yet — please choose Cash on Delivery, or contact the store.");
  }
  if (paymentMethod === "demo_card" && !settingsService.resolveFeatureFlags(settings).demoCard) {
    throw ApiError.badRequest("Demo card checkout is turned off for this store.");
  }
}

const create = asyncHandler(async (req, res) => {
  const settings = await settingsService.getOrCreate();
  verifyPaymentMethodAvailable(req.body.paymentMethod, settings);

  if (req.user) {
    const orders = await service.createFromCart(req.user.id, req.body);
    const data = await buildResponse(orders, req.body.paymentMethod, settings);
    return sendSuccess(res, { data, statusCode: 201 });
  }

  // Unauthenticated request — only allowed when the admin has guest checkout switched on.
  if (!settingsService.resolveFeatureFlags(settings).guestCheckout) {
    throw ApiError.unauthorized("Please log in to place an order.");
  }

  const { guestEmail, guestName, guestAddress, shippingMethodId, paymentMethod } = req.body;
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) throw ApiError.badRequest("Guest checkout requires an X-Session-Id header.");
  if (!guestEmail || !guestName || !guestAddress) {
    throw ApiError.badRequest("Guest checkout requires guestEmail, guestName, and guestAddress.");
  }

  const guestUser = await authService.findOrCreateGuestUser({ email: guestEmail, name: guestName });
  await cartService.mergeGuestCart(guestUser.id, sessionId);
  const address = await prisma.address.create({ data: { userId: guestUser.id, ...guestAddress } });

  const orders = await service.createFromCart(guestUser.id, {
    shippingAddressId: address.id,
    shippingMethodId,
    paymentMethod,
  });
  const data = await buildResponse(orders, paymentMethod, settings);
  sendSuccess(res, { data, statusCode: 201 });
});

const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listForUser(req.user.id, req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const order = await service.getByIdForUser(req.user.id, req.params.id);
  sendSuccess(res, { data: order });
});

const invoice = asyncHandler(async (req, res) => {
  const order = await service.getByIdRaw(req.params.id);
  const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
  if (!isAdmin && order.userId !== req.user.id) throw ApiError.forbidden();
  const settings = await settingsService.getOrCreate();
  streamInvoice(res, { order, settings });
});

const cancel = asyncHandler(async (req, res) => {
  const order = await service.requestCancellation(req.user.id, req.params.id, { reason: req.body.reason, ipAddress: req.ip });
  sendSuccess(res, { data: order });
});

const requestReturn = asyncHandler(async (req, res) => {
  const order = await service.requestReturn(req.user.id, req.params.id, { reason: req.body.reason, ipAddress: req.ip });
  sendSuccess(res, { data: order });
});

const requestExchange = asyncHandler(async (req, res) => {
  const order = await service.requestExchange(req.user.id, req.params.id, { reason: req.body.reason, ipAddress: req.ip });
  sendSuccess(res, { data: order });
});

module.exports = { create, list, getById, invoice, cancel, requestReturn, requestExchange };
