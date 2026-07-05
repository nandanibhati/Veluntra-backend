const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./shipping.service");

const list = asyncHandler(async (req, res) => {
  const methods = await service.list();
  sendSuccess(res, { data: methods });
});

const create = asyncHandler(async (req, res) => {
  const method = await service.create(req.body);
  sendSuccess(res, { data: method, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  const method = await service.update(req.params.id, req.body);
  sendSuccess(res, { data: method });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { list, create, update, remove };
