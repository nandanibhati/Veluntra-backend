const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { logActivity } = require("../../utils/activityLog");
const { slugify } = require("./categories.validation");

async function list() {
  const categories = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return categories.map((c) => toPlain({ ...c, productCount: c._count.products, _count: undefined }));
}

async function create({ name, slug, ...rest }, { actorId, ipAddress } = {}) {
  const finalSlug = slug ? slugify(slug) : slugify(name);
  const category = await prisma.category.create({ data: { name, slug: finalSlug, ...rest } });
  await logActivity({
    actorId,
    action: `Created category "${category.name}"`,
    scope: "catalog",
    entityType: "Category",
    entityId: category.id,
    newValue: toPlain(category),
    ipAddress,
  });
  return toPlain(category);
}

async function update(id, data, { actorId, ipAddress } = {}) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Category not found.");
  const category = await prisma.category.update({
    where: { id },
    data: { ...data, slug: data.slug ? slugify(data.slug) : undefined },
  });
  await logActivity({
    actorId,
    action: `Updated category "${existing.name}"`,
    scope: "catalog",
    entityType: "Category",
    entityId: id,
    previousValue: toPlain(existing),
    newValue: toPlain(category),
    ipAddress,
  });
  return toPlain(category);
}

async function remove(id, { actorId, ipAddress } = {}) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Category not found.");
  await prisma.category.delete({ where: { id } });
  await logActivity({
    actorId,
    action: `Deleted category "${existing.name}"`,
    scope: "catalog",
    entityType: "Category",
    entityId: id,
    previousValue: toPlain(existing),
    ipAddress,
  });
}

/** Bulk-set display order for the homepage/admin category grid — drag-and-drop reorder. */
async function reorder(items, { actorId, ipAddress }) {
  await prisma.$transaction(
    items.map(({ id, position }) => prisma.category.update({ where: { id }, data: { position } }))
  );
  await logActivity({
    actorId,
    action: `Reordered ${items.length} categories`,
    scope: "catalog",
    entityType: "Category",
    entityId: "bulk",
    newValue: { items },
    ipAddress,
  });
  return list();
}

module.exports = { list, create, update, remove, reorder };
