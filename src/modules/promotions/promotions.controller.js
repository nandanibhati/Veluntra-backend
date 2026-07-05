const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./promotions.service");

const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.list(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const listActive = asyncHandler(async (req, res) => {
  const items = (await service.listActiveWithScope()).map(service.withComputedStatus);
  sendSuccess(res, { data: items });
});

const create = asyncHandler(async (req, res) => {
  const promo = await service.create(req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: promo, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const promo = await service.update(req.params.id, req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: promo });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { list, listActive, create, update, remove };
