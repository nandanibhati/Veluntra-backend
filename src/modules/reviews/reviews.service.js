const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const { recalculateRating } = require("../products/products.service");
const settingsService = require("../settings/settings.service");

function withInitials(review) {
  return toPlain({
    ...review,
    name: review.user.name,
    initials: review.user.name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    user: undefined,
  });
}

/** Site-wide testimonials for the homepage — real approved reviews, highest-rated/featured first. */
async function listFeaturedSitewide(limit = 8) {
  const reviews = await prisma.review.findMany({
    where: { status: "approved" },
    orderBy: [{ isFeatured: "desc" }, { rating: "desc" }, { helpfulCount: "desc" }],
    take: limit,
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
  });
  return reviews.map((r) =>
    toPlain({
      ...r,
      name: r.user.name,
      productName: r.product.name,
      productSlug: r.product.slug,
      initials: r.user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      user: undefined,
      product: undefined,
    })
  );
}

async function listForProduct(productId) {
  const reviews = await prisma.review.findMany({
    where: { productId, status: "approved" },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true } } },
  });
  return reviews.map(withInitials);
}

async function create(productId, userId, data) {
  const settings = await settingsService.getOrCreate();
  if (!settingsService.resolveFeatureFlags(settings).reviews) {
    throw ApiError.forbidden("Reviews are currently disabled.");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound("Product not found.");

  const existing = await prisma.review.findFirst({ where: { productId, userId } });
  if (existing) throw ApiError.conflict("You've already reviewed this product.");

  // A review only counts as "verified" if the reviewer actually bought the product.
  const purchased = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: { in: ["delivered", "shipped"] } } },
  });

  const review = await prisma.review.create({
    data: { productId, userId, ...data, isVerified: Boolean(purchased), status: "pending" },
  });

  return toPlain(review);
}

async function markHelpful(reviewId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found.");
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { helpfulCount: { increment: 1 } },
  });
  return toPlain(updated);
}

async function reportAbuse(reviewId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found.");
  const updated = await prisma.review.update({ where: { id: reviewId }, data: { reportCount: { increment: 1 } } });
  return toPlain(updated);
}

// ---------- Moderation (admin / seller-of-the-product) ----------

async function listForModeration(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.status && query.status !== "all") where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: { name: true } }, product: { select: { name: true, storeId: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ]);
  return { items: items.map((r) => toPlain({ ...r, reviewer: r.user.name, productName: r.product.name, user: undefined })), page, limit, total };
}

async function setStatus(reviewId, status) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found.");
  const updated = await prisma.review.update({ where: { id: reviewId }, data: { status } });
  if (status === "approved" || review.status === "approved") await recalculateRating(review.productId);
  return toPlain(updated);
}

async function setFeatured(reviewId, isFeatured) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found.");
  const updated = await prisma.review.update({ where: { id: reviewId }, data: { isFeatured } });
  return toPlain(updated);
}

async function reply(reviewId, sellerReply) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found.");
  const updated = await prisma.review.update({ where: { id: reviewId }, data: { sellerReply } });
  return toPlain(updated);
}

async function remove(reviewId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found.");
  await prisma.review.delete({ where: { id: reviewId } });
  if (review.status === "approved") await recalculateRating(review.productId);
}

module.exports = {
  listFeaturedSitewide,
  listForProduct,
  create,
  markHelpful,
  reportAbuse,
  listForModeration,
  setStatus,
  setFeatured,
  reply,
  remove,
};
