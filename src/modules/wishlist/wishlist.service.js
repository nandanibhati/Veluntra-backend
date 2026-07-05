const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const settingsService = require("../settings/settings.service");

async function list(userId) {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
  });
  return items.map(toPlain);
}

async function add(userId, productId) {
  const settings = await settingsService.getOrCreate();
  if (!settingsService.resolveFeatureFlags(settings).wishlist) {
    throw ApiError.forbidden("The wishlist feature is currently disabled.");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound("Product not found.");

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) return toPlain(existing);

  const item = await prisma.wishlistItem.create({ data: { userId, productId } });
  return toPlain(item);
}

async function remove(userId, productId) {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}

module.exports = { list, add, remove };
