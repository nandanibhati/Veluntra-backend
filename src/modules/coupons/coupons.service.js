const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const { logActivity } = require("../../utils/activityLog");
const { couponDiscount } = require("../../utils/pricing");
const settingsService = require("../settings/settings.service");

/** Admin sees every coupon; a seller only ever sees/manages their own store's coupons. */
async function list(query, { storeId, isAdmin }) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = isAdmin ? {} : { storeId };
  const [items, total] = await Promise.all([
    prisma.coupon.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.coupon.count({ where }),
  ]);
  return { items: items.map(toPlain), page, limit, total };
}

async function create(data, { storeId, isAdmin, actorId, ipAddress }) {
  if (!isAdmin) {
    const settings = await settingsService.getOrCreate();
    const flags = settingsService.resolveFeatureFlags(settings);
    if (!settings.allowSellerCoupons || !flags.sellerCoupons) {
      throw ApiError.forbidden("Seller-created coupons are currently disabled by the platform.");
    }
  }
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
  if (existing) throw ApiError.conflict("A coupon with this code already exists.");

  const coupon = await prisma.coupon.create({
    data: { ...data, usageCount: 0, storeId: isAdmin ? data.storeId || null : storeId },
  });

  await logActivity({
    actorId,
    action: `Created coupon ${coupon.code}`,
    scope: "coupons",
    entityType: "Coupon",
    entityId: coupon.id,
    newValue: { code: coupon.code, type: coupon.type, value: Number(coupon.value) },
    ipAddress,
  });

  return toPlain(coupon);
}

async function update(id, data, { storeId, isAdmin, actorId, ipAddress }) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Coupon not found.");
  if (!isAdmin && existing.storeId !== storeId) throw ApiError.forbidden("This coupon does not belong to your store.");

  const coupon = await prisma.coupon.update({ where: { id }, data });

  await logActivity({
    actorId,
    action: `Updated coupon ${existing.code}`,
    scope: "coupons",
    entityType: "Coupon",
    entityId: id,
    previousValue: { value: Number(existing.value), enabled: existing.enabled, usageLimit: existing.usageLimit },
    newValue: { value: Number(coupon.value), enabled: coupon.enabled, usageLimit: coupon.usageLimit },
    ipAddress,
  });

  return toPlain(coupon);
}

async function remove(id, { storeId, isAdmin, actorId, ipAddress }) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Coupon not found.");
  if (!isAdmin && existing.storeId !== storeId) throw ApiError.forbidden("This coupon does not belong to your store.");
  await prisma.coupon.delete({ where: { id } });
  await logActivity({
    actorId,
    action: `Deleted coupon ${existing.code}`,
    scope: "coupons",
    entityType: "Coupon",
    entityId: id,
    previousValue: { code: existing.code },
    ipAddress,
  });
}

/** Any coupon flagged to apply automatically (no code entry needed), platform-wide or store-specific. */
async function listAutoApply() {
  const now = new Date();
  return prisma.coupon.findMany({ where: { autoApply: true, enabled: true, expiresAt: { gt: now } } });
}

/** Fetches + validates a coupon's own rules (enabled/expiry/usage/per-user) — NOT the subtotal, since a
 * store-scoped coupon's minSubtotal must be checked against only that store's share of the cart. */
async function findValidCoupon(code, userId) {
  const settings = await settingsService.getOrCreate();
  if (!settingsService.resolveFeatureFlags(settings).coupons) {
    throw ApiError.badRequest("Coupons are currently disabled.");
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw ApiError.badRequest("This code isn't valid or has expired.");
  if (!coupon.enabled) throw ApiError.badRequest("This code isn't valid or has expired.");
  if (coupon.expiresAt < new Date()) throw ApiError.badRequest("This code isn't valid or has expired.");
  if (coupon.usageCount >= coupon.usageLimit) throw ApiError.badRequest("This code has reached its usage limit.");
  if (userId) {
    const redemptions = await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (redemptions >= coupon.perUserLimit) {
      throw ApiError.badRequest("You've already used this code the maximum number of times.");
    }
  }
  return coupon;
}

/** Convenience wrapper for the common case (platform-wide coupon checked against the whole cart subtotal). */
async function validateForSubtotal(code, subtotal, userId) {
  const coupon = await findValidCoupon(code, userId);
  if (coupon.minSubtotal && Number(coupon.minSubtotal) > subtotal) {
    throw ApiError.badRequest(`This code requires a subtotal of £${Number(coupon.minSubtotal)}+.`);
  }
  return coupon;
}

function computeDiscount(coupon, subtotal) {
  return couponDiscount(coupon, subtotal);
}

module.exports = { list, create, update, remove, listAutoApply, findValidCoupon, validateForSubtotal, computeDiscount };
