const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./homepage.service");

const listPublic = asyncHandler(async (req, res) => {
  const sections = await service.listPublic();
  sendSuccess(res, { data: sections });
});

const listAll = asyncHandler(async (req, res) => {
  const sections = await service.listAll();
  sendSuccess(res, { data: sections });
});

const create = asyncHandler(async (req, res) => {
  const section = await service.create(req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: section, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const section = await service.update(req.params.id, req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: section });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: { deleted: true } });
});

const reorder = asyncHandler(async (req, res) => {
  const sections = await service.reorder(req.body.items, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: sections });
});

module.exports = { listPublic, listAll, create, update, remove, reorder };
