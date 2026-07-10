const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const { streamInvoice } = require("../../utils/invoice");
const ApiError = require("../../utils/ApiError");
const prisma = require("../../config/db");
const service = require("./admin.service");
const ordersService = require("../orders/orders.service");
const settingsService = require("../settings/settings.service");
const authService = require("../auth/auth.service");
const warehouseInventoryService = require("../inventory/warehouseInventory.service");

const listUsers = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listUsers(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const getCustomerDetail = asyncHandler(async (req, res) => {
  const customer = await service.getCustomerDetail(req.params.id);
  sendSuccess(res, { data: customer });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const user = await service.setUserStatus(req.user.id, req.params.id, req.body.status, req.ip);
  sendSuccess(res, { data: user });
});

const setUserRole = asyncHandler(async (req, res) => {
  const user = await service.setUserRole(req.user.id, req.params.id, req.body.role, req.ip);
  sendSuccess(res, { data: user });
});

const createAdmin = asyncHandler(async (req, res) => {
  const user = await service.createAdmin(req.user.id, req.body, req.ip);
  sendSuccess(res, { data: user, statusCode: 201 });
});

const deleteUser = asyncHandler(async (req, res) => {
  await service.deleteUser(req.user.id, req.params.id, req.ip);
  sendSuccess(res, { data: { deleted: true } });
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw ApiError.notFound("User not found.");
  const result = await authService.requestPasswordReset(user.email);
  sendSuccess(res, { data: result });
});

const listStores = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listStores(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const setStoreStatus = asyncHandler(async (req, res) => {
  const store = await service.setStoreStatus(req.user.id, req.params.id, req.body.status, req.ip);
  sendSuccess(res, { data: store });
});

const setStoreCommission = asyncHandler(async (req, res) => {
  const store = await service.setStoreCommission(req.user.id, req.params.id, req.body.commissionPercent, req.ip);
  sendSuccess(res, { data: store });
});

const listOrders = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listOrders(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await ordersService.updateStatus(req.params.id, req.body, {
    isAdmin: true,
    actorId: req.user.id,
    ipAddress: req.ip,
  });
  sendSuccess(res, { data: order });
});

const assignSeller = asyncHandler(async (req, res) => {
  const order = await ordersService.updateStatus(
    req.params.id,
    { storeId: req.body.storeId },
    { isAdmin: true, actorId: req.user.id, ipAddress: req.ip }
  );
  sendSuccess(res, { data: order });
});

const orderInvoice = asyncHandler(async (req, res) => {
  const order = await ordersService.getByIdRaw(req.params.id);
  const settings = await settingsService.getOrCreate();
  streamInvoice(res, { order, settings });
});

const listProducts = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listProducts(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const listActivityLogs = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listActivityLogs(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const analytics = asyncHandler(async (req, res) => {
  const period = ["day", "week", "month"].includes(req.query.period) ? req.query.period : "month";
  const [overview, revenueTrend, ordersByCategory, topProducts, topCategories, sellerPerformance, paymentSplit, customerTrend] =
    await Promise.all([
      service.overview(),
      service.revenueTrend(period),
      service.ordersByCategory(),
      service.topProducts(),
      service.topCategories(),
      service.sellerPerformance(),
      service.paymentSplit(),
      service.customerTrend(),
    ]);
  sendSuccess(res, {
    data: { overview, revenueTrend, ordersByCategory, topProducts, topCategories, sellerPerformance, paymentSplit, customerTrend },
  });
});

const dashboardSummary = asyncHandler(async (req, res) => {
  const data = await service.dashboardSummary();
  sendSuccess(res, { data });
});

const listWarehouseStock = asyncHandler(async (req, res) => {
  const rows = await warehouseInventoryService.list(req.query);
  sendSuccess(res, { data: rows });
});

const adjustWarehouseStock = asyncHandler(async (req, res) => {
  const { variantId, delta, reason } = req.body;
  const stock = await prisma.$transaction((tx) =>
    warehouseInventoryService.adjust(tx, {
      productId: req.params.productId,
      variantId: variantId || null,
      delta,
      actorId: req.user.id,
      reason,
    })
  );
  sendSuccess(res, { data: { stock } });
});

const warehouseStockHistory = asyncHandler(async (req, res) => {
  const rows = await warehouseInventoryService.transactionsFor(req.params.productId, req.query.variantId);
  sendSuccess(res, { data: rows });
});

module.exports = {
  listUsers,
  getCustomerDetail,
  setUserStatus,
  setUserRole,
  createAdmin,
  deleteUser,
  resetUserPassword,
  listStores,
  setStoreStatus,
  setStoreCommission,
  listOrders,
  updateOrderStatus,
  assignSeller,
  orderInvoice,
  listProducts,
  listActivityLogs,
  analytics,
  dashboardSummary,
  listWarehouseStock,
  adjustWarehouseStock,
  warehouseStockHistory,
};
