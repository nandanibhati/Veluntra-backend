const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./addresses.service");

const list = asyncHandler(async (req, res) => {
  const addresses = await service.list(req.user.id);
  sendSuccess(res, { data: addresses });
});

const create = asyncHandler(async (req, res) => {
  const address = await service.create(req.user.id, req.body);
  sendSuccess(res, { data: address, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const address = await service.update(req.user.id, req.params.id, req.body);
  sendSuccess(res, { data: address });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.user.id, req.params.id);
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { list, create, update, remove };
