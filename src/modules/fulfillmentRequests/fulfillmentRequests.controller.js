const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./fulfillmentRequests.service");
const sellerService = require("../seller/seller.service");

const create = asyncHandler(async (req, res) => {
  const store = await sellerService.getStoreForOwner(req.user.id, req.user.role);
  const request = await service.create(req.user.id, store.id, req.body);
  sendSuccess(res, { data: request, statusCode: 201 });
});

const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total, pendingCount } = await service.list(req.query);
  sendSuccess(res, { data: items, meta: { ...paginationMeta({ page, limit, total }), pendingCount } });
});

const approve = asyncHandler(async (req, res) => {
  const request = await service.approve(req.params.id, { adminId: req.user.id, adminNote: req.body.adminNote });
  sendSuccess(res, { data: request });
});

const reject = asyncHandler(async (req, res) => {
  const request = await service.reject(req.params.id, { adminId: req.user.id, adminNote: req.body.adminNote });
  sendSuccess(res, { data: request });
});

module.exports = { create, list, approve, reject };
