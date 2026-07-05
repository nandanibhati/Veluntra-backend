const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");

async function list() {
  const methods = await prisma.shippingMethod.findMany({ orderBy: { price: "asc" } });
  return methods.map(toPlain);
}

async function create(data) {
  const method = await prisma.shippingMethod.create({ data });
  return toPlain(method);
}

async function update(id, data) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Shipping method not found.");
  const method = await prisma.shippingMethod.update({ where: { id }, data });
  return toPlain(method);
}

async function remove(id) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Shipping method not found.");
  await prisma.shippingMethod.delete({ where: { id } });
}

module.exports = { list, create, update, remove };
