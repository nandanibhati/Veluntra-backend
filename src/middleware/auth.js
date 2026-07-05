const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");
const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const permissionsService = require("../modules/permissions/permissions.service");

/**
 * Verifies the Bearer access token and attaches `req.user` (id + role,
 * plus a lazily-fetched full record only where a handler needs it).
 * Stateless — works identically for the web app and any mobile client
 * that sends `Authorization: Bearer <token>`.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired access token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized("User no longer exists");
  if (user.status === "suspended") throw ApiError.forbidden("Account suspended");

  req.user = user;
  next();
});

/** Like requireAuth, but doesn't fail when no token is present — used for guest carts. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.status !== "suspended") req.user = user;
  } catch {
    // Invalid token on an optional route just means "treat as guest".
  }
  next();
});

/** Role guard — use after requireAuth. `superadmin` is a wildcard: it satisfies any role check
 * (it's the platform owner account, a superset of admin) without needing every route updated. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === "superadmin") return next();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Requires role: ${roles.join(" or ")}`);
    }
    next();
  };
}

/**
 * Permission guard for admin-configurable capabilities (Settings > Roles & Permissions).
 * Unlike requireRole (fixed at code-deploy time), this checks the DB-backed
 * RolePermission grid so an admin can delegate/restrict capabilities per role
 * without a code change. `superadmin` always passes.
 */
function requirePermission(key) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === "superadmin") return next();
    const allowed = await permissionsService.isAllowed(req.user.role, key);
    if (!allowed) throw ApiError.forbidden(`Missing permission: ${key}`);
    next();
  });
}

module.exports = { requireAuth, optionalAuth, requireRole, requirePermission };
