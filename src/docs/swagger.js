const env = require("../config/env");

/**
 * Base OpenAPI document. Route files annotate their own paths with
 * `@openapi` JSDoc comments (see swagger-jsdoc's `apis` glob in index.js),
 * which get merged into this document's `paths` at boot.
 */
const baseDocument = {
  openapi: "3.0.3",
  info: {
    title: "Veluntra API",
    version: "1.0.0",
    description:
      "Platform-agnostic REST API for the Veluntra storefront, seller console, and admin console. " +
      "Consumed by both the React web frontend and any future React Native mobile app — " +
      "auth is stateless JWT (no cookies), and every response follows the same envelope shape.",
  },
  servers: [{ url: `http://localhost:${env.port}/api/v1`, description: "Local" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      SuccessEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {},
          meta: {
            type: "object",
            properties: {
              page: { type: "integer" },
              limit: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      ErrorEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "Auth" },
    { name: "Categories" },
    { name: "Brands" },
    { name: "Products" },
    { name: "Reviews" },
    { name: "Cart" },
    { name: "Coupons" },
    { name: "Shipping" },
    { name: "Orders" },
    { name: "Addresses" },
    { name: "Wishlist" },
    { name: "Notifications" },
    { name: "Uploads" },
    { name: "Stats" },
    { name: "Promotions" },
    { name: "Settings" },
    { name: "Admin" },
    { name: "Seller" },
  ],
};

module.exports = baseDocument;
