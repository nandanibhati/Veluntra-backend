const { Router } = require("express");
const controller = require("./payments.controller");

const router = Router();

/**
 * @openapi
 * /webhooks/stripe:
 *   post:
 *     tags: [Payments]
 *     summary: Stripe webhook — marks orders paid on checkout.session.completed. Called by Stripe only.
 */
router.post("/stripe", controller.stripeWebhook);

module.exports = router;
