const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./seller.service");
const ordersService = require("../orders/orders.service");

const overview = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const period = ["day", "week", "month"].includes(req.query.period) ? req.query.period : "month";
  const [stats, revenueTrend, categorySales, topProducts] = await Promise.all([
    service.overview(store.id),
    service.revenueTrend(store.id, period),
    service.categorySales(store.id),
    service.topProducts(store.id),
  ]);
  sendSuccess(res, {
    data: { store: { id: store.id, name: store.name }, stats, revenueTrend, categorySales, topProducts },
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const { items, page, limit, total } = await service.listProducts(store.id, req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const listOrders = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const { items, page, limit, total } = await service.listOrders(store.id, req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const order = await ordersService.updateStatus(req.params.id, req.body, {
    storeId: store.id,
    isAdmin: false,
    actorId: req.user.id,
    ipAddress: req.ip,
  });
  sendSuccess(res, { data: order });
});

const listCustomers = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const customers = await service.listCustomers(store.id);
  sendSuccess(res, { data: customers });
});

module.exports = { overview, listProducts, listOrders, updateOrderStatus, listCustomers };
