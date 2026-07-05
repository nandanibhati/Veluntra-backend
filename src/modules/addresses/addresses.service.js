const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");

async function list(userId) {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return addresses.map(toPlain);
}

async function create(userId, data) {
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const address = await prisma.address.create({ data: { ...data, userId } });
  return toPlain(address);
}

async function update(userId, id, data) {
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw ApiError.notFound("Address not found.");
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const address = await prisma.address.update({ where: { id }, data });
  return toPlain(address);
}

async function remove(userId, id) {
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw ApiError.notFound("Address not found.");
  await prisma.address.delete({ where: { id } });
}

module.exports = { list, create, update, remove };
