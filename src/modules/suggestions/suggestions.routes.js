const { Router } = require("express");
const validate = require("../../middleware/validate");
const { optionalAuth } = require("../../middleware/auth");
const { suggestionLimiter } = require("../../middleware/rateLimit");
const { createSuggestionSchema } = require("./suggestions.validation");
const controller = require("./suggestions.controller");

const router = Router();

/**
 * @openapi
 * /suggestions:
 *   post:
 *     tags: [Suggestions]
 *     summary: Submit a suggestion/feedback note — open to guests and logged-in shoppers alike
 */
router.post("/", suggestionLimiter, optionalAuth, validate({ body: createSuggestionSchema }), controller.create);

module.exports = router;
