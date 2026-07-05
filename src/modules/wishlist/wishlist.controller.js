const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const service = require("./wishlist.service");

const list = asyncHandler(async (req, res) => {
  const items = await service.list(req.user.id);
  sendSuccess(res, { data: items });
});

const add = asyncHandler(async (req, res) => {
  const item = await service.add(req.user.id, req.body.productId);
  sendSuccess(res, { data: item, statusCode: 201 });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.user.id, req.params.productId);
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { list, add, remove };
