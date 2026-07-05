const prisma = require("../config/db");
const notificationsService = require("../modules/notifications/notifications.service");

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const SOON_WINDOW_MS = 2 * 60 * 60 * 1000; // "ending/expiring soon" = within 2 hours

/**
 * Lightweight in-process scheduler for time-based automatic notifications
 * (offers starting/ending, coupons expiring, low stock). No external cron
 * infra required — good enough for a single-instance deployment; swap for
 * a real job queue (BullMQ, etc.) if this ever runs on multiple instances.
 */
async function notifyAdmins({ title, body }) {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  await Promise.all(admins.map((a) => notificationsService.create(a.id, { title, body })));
}

async function checkPromotionsStarting() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - CHECK_INTERVAL_MS);
  const startingNow = await prisma.promotion.findMany({
    where: { enabled: true, startsAt: { gte: windowStart, lte: now } },
  });
  for (const promo of startingNow) {
    await notifyAdmins({ title: "Offer started", body: `"${promo.name}" is now live.` });
  }
}

async function checkPromotionsEnding() {
  const now = new Date();
  const soon = new Date(now.getTime() + SOON_WINDOW_MS);
  const endingSoon = await prisma.promotion.findMany({
    where: { enabled: true, endsAt: { gte: now, lte: soon } },
  });
  for (const promo of endingSoon) {
    await notifyAdmins({ title: "Offer ending soon", body: `"${promo.name}" ends within 2 hours.` });
  }
}

async function checkCouponsExpiring() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiringSoon = await prisma.coupon.findMany({
    where: { enabled: true, expiresAt: { gte: now, lte: soon } },
  });
  for (const coupon of expiringSoon) {
    await notifyAdmins({ title: "Coupon expiring soon", body: `Coupon "${coupon.code}" expires within 24 hours.` });
  }
}

async function checkLowStock() {
  const products = await prisma.product.findMany({ where: { status: "published" } });
  const low = products.filter((p) => p.stock <= p.lowStockThreshold);
  if (low.length === 0) return;

  const stores = await prisma.store.findMany({ where: { id: { in: [...new Set(low.map((p) => p.storeId))] } } });
  const storeById = new Map(stores.map((s) => [s.id, s]));

  for (const product of low) {
    const store = storeById.get(product.storeId);
    if (!store) continue;
    await notificationsService.create(store.ownerId, {
      title: product.stock === 0 ? "Out of stock" : "Low stock alert",
      body: `"${product.name}" ${product.stock === 0 ? "is out of stock" : `has only ${product.stock} left`}.`,
    });
  }
}

async function runChecks() {
  try {
    await Promise.all([checkPromotionsStarting(), checkPromotionsEnding(), checkCouponsExpiring(), checkLowStock()]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[scheduler] check run failed:", err);
  }
}

let intervalHandle = null;

function startScheduler() {
  intervalHandle = setInterval(runChecks, CHECK_INTERVAL_MS);
  // Run once shortly after boot too, so the effect isn't invisible for 15 minutes in a demo.
  setTimeout(runChecks, 10_000);
}

function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startScheduler, stopScheduler, runChecks };
