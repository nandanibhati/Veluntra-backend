const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./settings.service");

const getPublic = asyncHandler(async (req, res) => {
  const settings = await service.getPublic();
  sendSuccess(res, { data: settings });
});

const getForAdmin = asyncHandler(async (req, res) => {
  const settings = await service.getForAdmin();
  sendSuccess(res, { data: settings });
});

const update = asyncHandler(async (req, res) => {
  const settings = await service.update(req.body, req.user.id, { ipAddress: req.ip, reason: req.body.reason });
  sendSuccess(res, { data: settings });
});

const getAuditHistory = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.getAuditHistory(req.query);
  sendSuccess(res, { data: items, meta: { page, limit, total } });
});

const restore = asyncHandler(async (req, res) => {
  const settings = await service.restoreFromLog(req.params.logId, req.user.id, { ipAddress: req.ip, reason: req.body.reason });
  sendSuccess(res, { data: settings });
});

module.exports = { getPublic, getForAdmin, update, getAuditHistory, restore };
