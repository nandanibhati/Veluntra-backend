const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./brands.service");

const list = asyncHandler(async (req, res) => {
  const brands = await service.list();
  sendSuccess(res, { data: brands });
});

const create = asyncHandler(async (req, res) => {
  const brand = await service.create(req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: brand, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const brand = await service.update(req.params.id, req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: brand });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: true } });
});

const reorder = asyncHandler(async (req, res) => {
  const brands = await service.reorder(req.body.items, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: brands });
});

module.exports = { list, create, update, remove, reorder };
