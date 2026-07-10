const asyncHandler = require("../../utils/asyncHandler");
const paymentsService = require("./payments.service");
const ordersService = require("../orders/orders.service");
const logger = require("../../config/logger");

/**
 * Stripe calls this directly (never the browser) whenever a Checkout Session's status changes.
 * Signature-verified against the raw body — see app.js, which mounts this route with
 * express.raw() *before* the global express.json() so the body arrives unparsed here.
 */
const stripeWebhook = asyncHandler(async (req, res) => {
  let event;
  try {
    event = paymentsService.constructWebhookEvent(req.body, req.headers["stripe-signature"]);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderIds = (session.metadata?.orderIds || "").split(",").filter(Boolean);
    if (orderIds.length > 0) await ordersService.markPaid(orderIds);
  }

  res.json({ received: true });
});

module.exports = { stripeWebhook };
