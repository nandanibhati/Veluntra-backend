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

const getHistory = asyncHandler(async (req, res) => {
  const history = await service.getHistory(req.query);
  sendSuccess(res, { data: history });
});

const restore = asyncHandler(async (req, res) => {
  const section = await service.restoreFromLog(req.params.logId, req.user.id, {
    ipAddress: req.ip,
    reason: req.body.reason,
  });
  sendSuccess(res, { data: section });
});

const saveDraft = asyncHandler(async (req, res) => {
  const section = await service.saveDraft(req.params.id, req.body, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: section });
});

const publishDraft = asyncHandler(async (req, res) => {
  const section = await service.publishDraft(req.params.id, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: section });
});

const discardDraft = asyncHandler(async (req, res) => {
  const section = await service.discardDraft(req.params.id, { actorId: req.user.id, ipAddress: req.ip });
  sendSuccess(res, { data: section });
});

module.exports = { listPublic, listAll, create, update, remove, reorder, getHistory, restore, saveDraft, publishDraft, discardDraft };
