const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./permissions.service");

const getGrid = asyncHandler(async (req, res) => {
  const grid = await service.getGrid();
  sendSuccess(res, { data: { permissions: service.PERMISSION_KEYS, grid } });
});

const bulkSet = asyncHandler(async (req, res) => {
  const grid = await service.bulkSet(req.body.items, { actorId: req.user.id, ipAddress: req.ip, reason: req.body.reason });
  sendSuccess(res, { data: { permissions: service.PERMISSION_KEYS, grid } });
});

module.exports = { getGrid, bulkSet };
