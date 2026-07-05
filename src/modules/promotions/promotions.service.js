const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const { logActivity } = require("../../utils/activityLog");
const settingsService = require("../settings/settings.service");

/** `status` here is always derived live from startsAt/endsAt/enabled — never a stored flag. */
function withComputedStatus(promo) {
  const now = new Date();
  let status = "scheduled";
  if (!promo.enabled) status = "disabled";
  else if (promo.startsAt <= now && promo.endsAt >= now) status = "active";
  else if (promo.endsAt < now) status = "ended";
  return toPlain({ ...promo, status });
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const [items, total] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { startsAt: "desc" }, skip, take }),
    prisma.promotion.count(),
  ]);
  return { items: items.map(withComputedStatus), page, limit, total };
}

async function create(data, { actorId, ipAddress } = {}) {
  const promo = await prisma.promotion.create({ data });
  await logActivity({
    actorId,
    action: `Created promotion "${promo.name}"`,
    scope: "promotions",
    entityType: "Promotion",
    entityId: promo.id,
    newValue: toPlain(promo),
    ipAddress,
  });
  return withComputedStatus(promo);
}

async function update(id, data, { actorId, ipAddress } = {}) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Promotion not found.");
  const promo = await prisma.promotion.update({ where: { id }, data });
  await logActivity({
    actorId,
    action: `Updated promotion "${existing.name}"`,
    scope: "promotions",
    entityType: "Promotion",
    entityId: id,
    previousValue: toPlain(existing),
    newValue: toPlain(promo),
    ipAddress,
  });
  return withComputedStatus(promo);
}

async function remove(id, { actorId, ipAddress } = {}) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Promotion not found.");
  await prisma.promotion.delete({ where: { id } });
  await logActivity({
    actorId,
    action: `Deleted promotion "${existing.name}"`,
    scope: "promotions",
    entityType: "Promotion",
    entityId: id,
    previousValue: toPlain(existing),
    ipAddress,
  });
}

/** Admin can disable the whole flash-sale mechanic platform-wide without touching individual promotions. */
async function flashSaleWhereClause() {
  const settings = await settingsService.getOrCreate();
  if (settingsService.resolveFeatureFlags(settings).flashSale === false) {
    return { type: { not: "flash_sale" } };
  }
  return {};
}

/** All currently-active promotions (used by the pricing engine — no per-product query needed). */
async function listActive() {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { enabled: true, startsAt: { lte: now }, endsAt: { gte: now }, ...(await flashSaleWhereClause()) },
  });
  return promotions;
}

/** Same as listActive, but with category/brand/product relations resolved — for storefront display. */
async function listActiveWithScope() {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { enabled: true, startsAt: { lte: now }, endsAt: { gte: now }, ...(await flashSaleWhereClause()) },
    include: { category: true, brand: true, product: true },
  });
  return promotions.map(toPlain);
}

module.exports = { list, create, update, remove, listActive, listActiveWithScope, withComputedStatus };
