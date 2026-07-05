const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { logActivity } = require("../../utils/activityLog");
const { slugify } = require("./brands.validation");

async function list() {
  const brands = await prisma.brand.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return brands.map((b) => toPlain({ ...b, productCount: b._count.products, _count: undefined }));
}

async function create({ name, slug, ...rest }, { actorId, ipAddress } = {}) {
  const finalSlug = slug ? slugify(slug) : slugify(name);
  const brand = await prisma.brand.create({ data: { name, slug: finalSlug, ...rest } });
  await logActivity({
    actorId,
    action: `Created brand "${brand.name}"`,
    scope: "catalog",
    entityType: "Brand",
    entityId: brand.id,
    newValue: toPlain(brand),
    ipAddress,
  });
  return toPlain(brand);
}

async function update(id, data, { actorId, ipAddress } = {}) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Brand not found.");
  const brand = await prisma.brand.update({
    where: { id },
    data: { ...data, slug: data.slug ? slugify(data.slug) : undefined },
  });
  await logActivity({
    actorId,
    action: `Updated brand "${existing.name}"`,
    scope: "catalog",
    entityType: "Brand",
    entityId: id,
    previousValue: toPlain(existing),
    newValue: toPlain(brand),
    ipAddress,
  });
  return toPlain(brand);
}

async function remove(id, { actorId, ipAddress } = {}) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Brand not found.");
  await prisma.brand.delete({ where: { id } });
  await logActivity({
    actorId,
    action: `Deleted brand "${existing.name}"`,
    scope: "catalog",
    entityType: "Brand",
    entityId: id,
    previousValue: toPlain(existing),
    ipAddress,
  });
}

/** Bulk-set display order for the homepage/admin brand strip — drag-and-drop reorder. */
async function reorder(items, { actorId, ipAddress }) {
  await prisma.$transaction(
    items.map(({ id, position }) => prisma.brand.update({ where: { id }, data: { position } }))
  );
  await logActivity({
    actorId,
    action: `Reordered ${items.length} brands`,
    scope: "catalog",
    entityType: "Brand",
    entityId: "bulk",
    newValue: { items },
    ipAddress,
  });
  return list();
}

module.exports = { list, create, update, remove, reorder };
