const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./wholesaleOrderRequests.service");

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

const create = asyncHandler(async (req, res) => {
  const request = await service.create(req.user.id, req.body);
  sendSuccess(res, { data: request, statusCode: 201 });
});

const list = asyncHandler(async (req, res) => {
  const isAdmin = ADMIN_ROLES.has(req.user.role);
  const { items, page, limit, total } = await service.list(req.query, { wholesalerId: req.user.id, isAdmin });
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const setStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.setStatus(req.params.id, req.body.status) });
});

module.exports = { create, list, setStatus };
