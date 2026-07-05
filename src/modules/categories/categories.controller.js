const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./categories.service");

const list = asyncHandler(async (req, res) => {
  const categories = await service.list();
  sendSuccess(res, { data: categories });
});

const create = asyncHandler(async (req, res) => {
  const category = await service.create(req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: category, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const category = await service.update(req.params.id, req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: category });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: true } });
});

const reorder = asyncHandler(async (req, res) => {
  const categories = await service.reorder(req.body.items, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: categories });
});

module.exports = { list, create, update, remove, reorder };
