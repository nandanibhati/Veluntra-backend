const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess, paginationMeta } = require("../../utils/apiResponse");
const service = require("./reviews.service");

const list = asyncHandler(async (req, res) => {
  const reviews = await service.listForProduct(req.params.productId);
  sendSuccess(res, { data: reviews });
});

const create = asyncHandler(async (req, res) => {
  const review = await service.create(req.params.productId, req.user.id, req.body);
  sendSuccess(res, { data: review, statusCode: 201 });
});

const markHelpful = asyncHandler(async (req, res) => {
  const review = await service.markHelpful(req.params.reviewId);
  sendSuccess(res, { data: review });
});

const reportAbuse = asyncHandler(async (req, res) => {
  const review = await service.reportAbuse(req.params.reviewId);
  sendSuccess(res, { data: review });
});

const listForModeration = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await service.listForModeration(req.query);
  sendSuccess(res, { data: items, meta: paginationMeta({ page, limit, total }) });
});

const approve = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.setStatus(req.params.reviewId, "approved") });
});

const reject = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.setStatus(req.params.reviewId, "rejected") });
});

const setFeatured = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.setFeatured(req.params.reviewId, req.body.isFeatured) });
});

const reply = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.reply(req.params.reviewId, req.body.reply) });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.reviewId);
  sendSuccess(res, { data: { deleted: true } });
});

module.exports = { list, create, markHelpful, reportAbuse, listForModeration, approve, reject, setFeatured, reply, remove };
