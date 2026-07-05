const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const ApiError = require("../../utils/ApiError");
const prisma = require("../../config/db");
const service = require("./products.service");

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

async function resolveStoreContext(req) {
  if (ADMIN_ROLES.has(req.user.role)) {
    const storeId = req.body.storeId || req.query.storeId;
    if (!storeId) throw ApiError.badRequest("storeId is required for admin product operations.");
    return { storeId, isAdmin: true };
  }
  const store = await prisma.store.findUnique({ where: { ownerId: req.user.id } });
  if (!store) throw ApiError.badRequest("You don't have a store yet.");
  return { storeId: store.id, isAdmin: false };
}

/** Like resolveStoreContext, but admin doesn't need to name a storeId — bulk/duplicate ops already scope by product ownership. */
async function resolveActorContext(req) {
  if (ADMIN_ROLES.has(req.user.role)) return { storeId: null, isAdmin: true };
  const store = await prisma.store.findUnique({ where: { ownerId: req.user.id } });
  if (!store) throw ApiError.badRequest("You don't have a store yet.");
  return { storeId: store.id, isAdmin: false };
}

const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.list(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const getById = asyncHandler(async (req, res) => {
  const product = await service.getById(req.params.id);
  sendSuccess(res, { data: product });
});

const getByIdForManage = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const product = await service.getByIdForManage(req.params.id, ctx);
  sendSuccess(res, { data: product });
});

const create = asyncHandler(async (req, res) => {
  const { storeId } = await resolveStoreContext(req);
  const product = await service.create(req.body, { storeId, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: product, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const ctx = await resolveStoreContext(req).catch(() => ({ storeId: null, isAdmin: ADMIN_ROLES.has(req.user.role) }));
  const product = await service.update(req.params.id, req.body, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: product });
});

const remove = asyncHandler(async (req, res) => {
  const ctx = await resolveStoreContext(req).catch(() => ({ storeId: null, isAdmin: ADMIN_ROLES.has(req.user.role) }));
  await service.remove(req.params.id, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: true } });
});

const exportCsv = asyncHandler(async (req, res) => {
  const { storeId } = ADMIN_ROLES.has(req.user.role) ? { storeId: req.query.storeId || null } : await resolveStoreContext(req);
  const rows = await service.exportForStore(storeId);
  const csv = stringify(rows, { header: true, columns: service.EXPORT_COLUMNS });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="products.csv"');
  res.send(csv);
});

const importCsv = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No CSV file uploaded (field name: file).");
  const { storeId } = ADMIN_ROLES.has(req.user.role) ? { storeId: req.body.storeId } : await resolveStoreContext(req);
  if (!storeId) throw ApiError.badRequest("storeId is required.");

  const rows = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  const results = await service.bulkImport(rows, { storeId, actorId: req.user.id });
  sendSuccess(res, { data: results });
});

const bulkUpdatePrice = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, mode, value } = req.body;
  const products = await service.bulkUpdatePrice(ids, { mode, value }, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const bulkUpdateStock = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, mode, value } = req.body;
  const products = await service.bulkUpdateStock(ids, { mode, value }, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, status } = req.body;
  const products = await service.bulkUpdateStatus(ids, status, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const bulkUpdateFeatureFlags = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, ...flags } = req.body;
  const products = await service.bulkUpdateFeatureFlags(ids, flags, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const bulkDelete = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids } = req.body;
  await service.bulkDelete(ids, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: ids.length } });
});

const bulkUpdateCategory = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, categoryId } = req.body;
  const products = await service.bulkUpdateCategory(ids, categoryId, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const bulkUpdateBrand = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, brandId } = req.body;
  const products = await service.bulkUpdateBrand(ids, brandId, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const bulkUpdateTags = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { ids, mode, tags } = req.body;
  const products = await service.bulkUpdateTags(ids, { mode, tags }, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: products });
});

const duplicate = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const product = await service.duplicate(req.params.id, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: product, statusCode: 201 });
});

const adjustStock = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const product = await service.adjustStock(req.params.id, req.body, { ...ctx, actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: product });
});

const inventoryHistory = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const { items, page, limit, total } = await service.inventoryHistory(req.params.id, ctx, req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const ctx = await resolveActorContext(req);
  const analytics = await service.getAnalytics(req.params.id, ctx);
  sendSuccess(res, { data: analytics });
});

module.exports = {
  list,
  getById,
  getByIdForManage,
  create,
  update,
  remove,
  exportCsv,
  importCsv,
  bulkUpdatePrice,
  bulkUpdateStock,
  bulkUpdateStatus,
  bulkUpdateFeatureFlags,
  bulkUpdateCategory,
  bulkUpdateBrand,
  bulkUpdateTags,
  bulkDelete,
  duplicate,
  adjustStock,
  inventoryHistory,
  getAnalytics,
};
