const Stripe = require("stripe");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");

let stripeClient = null;
function getStripeClient() {
  if (!env.stripe.secretKey) return null;
  if (!stripeClient) stripeClient = new Stripe(env.stripe.secretKey);
  return stripeClient;
}

function isStripeEnabled() {
  return Boolean(env.stripe.secretKey);
}

/**
 * Creates one Stripe Checkout Session covering every order from a single checkout (a cart can
 * split into multiple Order rows when it spans more than one store — the customer still pays
 * once). Each order becomes its own line item so the Stripe receipt reads sensibly for a
 * multi-seller cart; all their ids are stashed in metadata for the webhook to mark paid.
 */
async function createCheckoutSession(orders, { currency }) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw ApiError.badRequest("Card payment isn't set up for this store yet — please choose Cash on Delivery, or contact the store.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: orders.map((order) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: { name: `Order ${order.orderNumber}` },
        unit_amount: Math.round(Number(order.total) * 100),
      },
      quantity: 1,
    })),
    metadata: { orderIds: orders.map((o) => o.id).join(",") },
    success_url: `${env.frontendUrl}/orders?payment=success&order=${orders[0].orderNumber}`,
    cancel_url: `${env.frontendUrl}/checkout?payment=cancelled`,
  });

  return session;
}

/** Verifies and parses a raw Stripe webhook request body. Throws if the signature is invalid —
 * the caller (controller) is expected to respond 400 in that case so Stripe retries safely. */
function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripeClient();
  if (!stripe || !env.stripe.webhookSecret) {
    throw ApiError.badRequest("Stripe webhook is not configured.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}

module.exports = { isStripeEnabled, createCheckoutSession, constructWebhookEvent };
