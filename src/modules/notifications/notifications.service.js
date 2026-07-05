const prisma = require("../../config/db");
const { toPlain } = require("../../utils/serialize");
const settingsService = require("../settings/settings.service");

async function list(userId) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return notifications.map(toPlain);
}

async function markRead(userId, id) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
}

async function markAllRead(userId) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

/** Called internally by other modules (e.g. order status changes) — not exposed as a public route. */
async function create(userId, { title, body }) {
  return prisma.notification.create({ data: { userId, title, body } });
}

/**
 * Registers a push token for this user/device. Actual push delivery
 * (via FCM/APNs) is a separate integration to wire up later — this just
 * gives that future feature a place to read tokens from.
 */
async function registerDevice(userId, { token, platform }) {
  const settings = await settingsService.getOrCreate();
  if (!settingsService.resolveFeatureFlags(settings).pushNotifications) {
    return { registered: false, reason: "push_notifications_disabled" };
  }
  const device = await prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform },
  });
  return { registered: true, ...toPlain(device) };
}

module.exports = { list, markRead, markAllRead, create, registerDevice };
