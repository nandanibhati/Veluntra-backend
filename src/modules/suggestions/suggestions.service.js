const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");

/** Anyone can submit — logged-in shoppers get their name/email/userId auto-filled, guests can
 * still send one with just a message (name/email optional so it never blocks a quick note). */
async function create(user, data) {
  const suggestion = await prisma.suggestion.create({
    data: {
      message: data.message,
      name: data.name || user?.name || null,
      email: data.email || user?.email || null,
      userId: user?.id || null,
    },
  });
  return toPlain(suggestion);
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.status && query.status !== "all") where.status = query.status;

  const [items, total, newCount] = await Promise.all([
    prisma.suggestion.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.suggestion.count({ where }),
    prisma.suggestion.count({ where: { status: "new" } }),
  ]);
  return { items: items.map(toPlain), page, limit, total, newCount };
}

async function setStatus(id, status) {
  const suggestion = await prisma.suggestion.findUnique({ where: { id } });
  if (!suggestion) throw ApiError.notFound("Suggestion not found.");
  const updated = await prisma.suggestion.update({ where: { id }, data: { status } });
  return toPlain(updated);
}

async function remove(id) {
  const suggestion = await prisma.suggestion.findUnique({ where: { id } });
  if (!suggestion) throw ApiError.notFound("Suggestion not found.");
  await prisma.suggestion.delete({ where: { id } });
}

module.exports = { create, list, setStatus, remove };
