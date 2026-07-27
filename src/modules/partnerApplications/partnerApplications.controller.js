const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./partnerApplications.service");

const create = asyncHandler(async (req, res) => {
  const application = await service.create(req.user, req.body);
  sendSuccess(res, { data: application, statusCode: 201 });
});

const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total, newCount } = await service.list(req.query);
  sendSuccess(res, { data: items, meta: { ...paginationMeta({ page, limit, total }), newCount } });
});

const setStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.setStatus(req.params.id, req.body.status) });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { create, list, setStatus, remove };
