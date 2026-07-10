const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const { toPlain } = require("../../utils/serialize");
const ApiError = require("../../utils/ApiError");
const { streamInvoice } = require("../../utils/invoice");
const { streamPackingSlip } = require("../../utils/packingSlip");
const { streamShippingLabel } = require("../../utils/shippingLabel");
const settingsService = require("../settings/settings.service");
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

const getStore = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  sendSuccess(res, { data: toPlain(store) });
});

const updateStoreBranding = asyncHandler(async (req, res) => {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const updated = await service.updateStoreBranding(store.id, req.body);
  sendSuccess(res, { data: updated });
});

async function ownOrderOrForbid(req) {
  const store = await service.getStoreForOwner(req.user.id, req.user.role);
  const order = await ordersService.getByIdRaw(req.params.id);
  if (order.storeId !== store.id) throw ApiError.forbidden("This order does not belong to your store.");
  return order;
}

const orderInvoice = asyncHandler(async (req, res) => {
  const order = await ownOrderOrForbid(req);
  const settings = await settingsService.getOrCreate();
  streamInvoice(res, { order, settings });
});

const orderPackingSlip = asyncHandler(async (req, res) => {
  const order = await ownOrderOrForbid(req);
  streamPackingSlip(res, { order });
});

const orderShippingLabel = asyncHandler(async (req, res) => {
  const order = await ownOrderOrForbid(req);
  streamShippingLabel(res, { order });
});

module.exports = {
  overview,
  listProducts,
  listOrders,
  updateOrderStatus,
  listCustomers,
  getStore,
  updateStoreBranding,
  orderInvoice,
  orderPackingSlip,
  orderShippingLabel,
};
