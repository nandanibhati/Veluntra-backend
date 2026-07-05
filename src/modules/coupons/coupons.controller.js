const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const ApiError = require("../../utils/ApiError");
const prisma = require("../../config/db");
const service = require("./coupons.service");

async function resolveStoreContext(req) {
  if (req.user.role === "admin" || req.user.role === "superadmin") return { storeId: null, isAdmin: true };
  const store = await prisma.store.findUnique({ where: { ownerId: req.user.id } });
  if (!store) throw ApiError.badRequest("You don't have a store yet.");
  return { storeId: store.id, isAdmin: false };
}

const list = asyncHandler(async (req, res) => {
  const ctx = await resolveStoreContext(req);
  const { items, page, limit, total } = await service.list(req.query, ctx);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const create = asyncHandler(async (req, res) => {
  const ctx = await resolveStoreContext(req);
  const coupon = await service.create(req.body, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: coupon, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const ctx = await resolveStoreContext(req);
  const coupon = await service.update(req.params.id, req.body, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: coupon });
});

const remove = asyncHandler(async (req, res) => {
  const ctx = await resolveStoreContext(req);
  await service.remove(req.params.id, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { list, create, update, remove };
