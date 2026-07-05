const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./notifications.service");

const list = asyncHandler(async (req, res) => {
  const notifications = await service.list(req.user.id);
  sendSuccess(res, { data: notifications });
});

const markRead = asyncHandler(async (req, res) => {
  await service.markRead(req.user.id, req.params.id);
  sendSuccess(res, { data: { read: true } });
});

const markAllRead = asyncHandler(async (req, res) => {
  await service.markAllRead(req.user.id);
  sendSuccess(res, { data: { read: true } });
});

const registerDevice = asyncHandler(async (req, res) => {
  const device = await service.registerDevice(req.user.id, req.body);
  sendSuccess(res, { data: device, statusCode: 201 });
});

module.exports = { list, markRead, markAllRead, registerDevice };
