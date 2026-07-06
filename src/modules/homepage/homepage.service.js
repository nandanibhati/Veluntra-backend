const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { logActivity } = require("../../utils/activityLog");
const { parsePagination } = require("../../utils/pagination");

/** Storefront-facing: enabled sections only, within their scheduled window (if set), in display order. */
async function listPublic() {
  const now = new Date();
  const sections = await prisma.homepageSection.findMany({
    where: {
      enabled: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
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

async function update(id, data, { actorId, ipAddress, reason }) {
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
    reason: reason || null,
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

/** Version history for the homepage editor — every add/edit/remove/reorder is already
 * logged to ActivityLog (see above); this just surfaces it for a "History" tab. */
async function getHistory(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = { scope: "homepage" };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return {
    items: items.map((l) => toPlain({ ...l, actorName: l.actor?.name || "System", actor: undefined })),
    page,
    limit,
    total,
  };
}

/**
 * Restores a single section to a previous audit-log snapshot. Works for both an edited
 * section (still exists — patched back to the old values) and a removed one (re-created
 * with its original id), but not for bulk reorder entries (no single-section snapshot).
 */
async function restoreFromLog(logId, actorId, { ipAddress, reason } = {}) {
  const log = await prisma.activityLog.findUnique({ where: { id: logId } });
  if (!log || log.scope !== "homepage" || !log.previousValue || log.entityId === "bulk") {
    throw ApiError.badRequest("This history entry cannot be restored.");
  }

  const snapshot = { ...log.previousValue };
  delete snapshot.id;
  delete snapshot.createdAt;
  delete snapshot.updatedAt;

  const existing = await prisma.homepageSection.findUnique({ where: { id: log.entityId } });
  if (existing) {
    return update(log.entityId, snapshot, { actorId, ipAddress, reason: reason || `Restored from history entry ${logId}` });
  }

  const section = await prisma.homepageSection.create({ data: { ...snapshot, id: log.entityId } });
  await logActivity({
    actorId,
    action: `Restored deleted homepage section "${section.title || section.type}"`,
    scope: "homepage",
    entityType: "HomepageSection",
    entityId: section.id,
    newValue: toPlain(section),
    reason: reason || `Restored from history entry ${logId}`,
    ipAddress,
  });
  return toPlain(section);
}

module.exports = { listPublic, listAll, create, update, remove, reorder, getHistory, restoreFromLog };
