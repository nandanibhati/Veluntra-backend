/**
 * The fixed catalogue of admin-delegatable capabilities. Adding a new
 * permission key here makes it configurable from Settings > Roles &
 * Permissions immediately — no migration needed (RolePermission rows are
 * created on demand when an admin actually changes a value away from default).
 */
const PERMISSION_KEYS = [
  "products.manage",
  "categories.manage",
  "coupons.manage",
  "promotions.manage",
  "orders.manage",
  "customers.manage",
  "sellers.manage",
  "settings.manage",
  "homepage.manage",
  "reviews.moderate",
  "analytics.view",
];

const CONFIGURABLE_ROLES = ["admin", "seller", "customer"];

// Sensible out-of-the-box behavior, used whenever no explicit RolePermission row exists.
const DEFAULT_PERMISSIONS = {
  admin: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])),
  seller: {
    "products.manage": true,
    "orders.manage": true,
    "coupons.manage": true,
    "analytics.view": true,
    "categories.manage": false,
    "promotions.manage": false,
    "customers.manage": false,
    "sellers.manage": false,
    "settings.manage": false,
    "homepage.manage": false,
    "reviews.moderate": false,
  },
  customer: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false])),
};

module.exports = { PERMISSION_KEYS, CONFIGURABLE_ROLES, DEFAULT_PERMISSIONS };
