const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");

/** Anyone can apply — logged-in shoppers get their userId attached so an approved application
 * can later be traced back to their account, guests can still apply with just contact details. */
async function create(user, data) {
  const application = await prisma.partnerApplication.create({
    data: {
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      companyName: data.companyName || null,
      website: data.website || null,
      taxId: data.taxId || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      country: data.country || null,
      postalCode: data.postalCode || null,
      referralSource: data.referralSource || null,
      message: data.message,
      userId: user?.id || null,
    },
  });
  return toPlain(application);
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.status && query.status !== "all") where.status = query.status;
  if (query.type && query.type !== "all") where.type = query.type;

  const [items, total, newCount] = await Promise.all([
    prisma.partnerApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.partnerApplication.count({ where }),
    prisma.partnerApplication.count({ where: { status: "new" } }),
  ]);
  return { items: items.map(toPlain), page, limit, total, newCount };
}

async function setStatus(id, status) {
  const application = await prisma.partnerApplication.findUnique({ where: { id } });
  if (!application) throw ApiError.notFound("Application not found.");
  const updated = await prisma.partnerApplication.update({ where: { id }, data: { status } });
  return toPlain(updated);
}

async function remove(id) {
  const application = await prisma.partnerApplication.findUnique({ where: { id } });
  if (!application) throw ApiError.notFound("Application not found.");
  await prisma.partnerApplication.delete({ where: { id } });
}

module.exports = { create, list, setStatus, remove };
