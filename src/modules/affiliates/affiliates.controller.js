const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./affiliates.service");

const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await service.getMyProfile(req.user.id);
  sendSuccess(res, { data: profile });
});

const createProfile = asyncHandler(async (req, res) => {
  const profile = await service.createProfile(req.body.userId, req.body);
  sendSuccess(res, { data: profile, statusCode: 201 });
});

const listProfiles = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listProfiles(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const addCommission = asyncHandler(async (req, res) => {
  const commission = await service.addCommission(req.params.id, req.body);
  sendSuccess(res, { data: commission, statusCode: 201 });
});

const setCommissionStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.setCommissionStatus(req.params.commissionId, req.body.status) });
});

module.exports = { getMyProfile, createProfile, listProfiles, addCommission, setCommissionStatus };
