const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { logActivity } = require("../../utils/activityLog");

/** Storefront-facing: enabled sections only, in display order. */
async function listPublic() {
  const sections = await prisma.homepageSection.findMany({
    where: { enabled: true },
    orderBy: { position: "asc" },
  });
  return sections.map(toPlain);
}

/** Admin CMS editor: every section, including disabled ones. */
async function listAll() {
  const sections = await prisma.homepageSection.findMany({ orderBy: { position: "asc" } });
  return sections.map(toPlain);
}

async function create(data, { actorId, ipAddress }) {
  const maxPosition = await prisma.homepageSection.aggregate({ _max: { position: true } });
  const section = await prisma.homepageSection.create({
    data: { ...data, position: data.position ?? (maxPosition._max.position ?? -1) + 1 },
  });
  await logActivity({
    actorId,
    action: `Added homepage section "${section.title || section.type}"`,
    scope: "homepage",
    entityType: "HomepageSection",
    entityId: section.id,
    newValue: toPlain(section),
    ipAddress,
  });
  return toPlain(section);
}

async function update(id, data, { actorId, ipAddress }) {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Homepage section not found.");
  const section = await prisma.homepageSection.update({ where: { id }, data });
  await logActivity({
    actorId,
    action: `Updated homepage section "${existing.title || existing.type}"`,
    scope: "homepage",
    entityType: "HomepageSection",
    entityId: id,
    previousValue: toPlain(existing),
    newValue: toPlain(section),
    ipAddress,
  });
  return toPlain(section);
}

async function remove(id, { actorId, ipAddress }) {
  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Homepage section not found.");
  await prisma.homepageSection.delete({ where: { id } });
  await logActivity({
    actorId,
    action: `Removed homepage section "${existing.title || existing.type}"`,
    scope: "homepage",
    entityType: "HomepageSection",
    entityId: id,
    previousValue: toPlain(existing),
    ipAddress,
  });
}

async function reorder(items, { actorId, ipAddress }) {
  await prisma.$transaction(
    items.map(({ id, position }) => prisma.homepageSection.update({ where: { id }, data: { position } }))
  );
  await logActivity({
    actorId,
    action: `Reordered ${items.length} homepage sections`,
    scope: "homepage",
    entityType: "HomepageSection",
    entityId: "bulk",
    newValue: { items },
    ipAddress,
  });
  return listAll();
}

module.exports = { listPublic, listAll, create, update, remove, reorder };
