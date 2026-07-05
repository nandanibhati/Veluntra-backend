const prisma = require("../config/db");

/**
 * Writes one audit-trail row. Every admin/seller mutation that changes
 * state should call this with the before/after values and the request's
 * IP address so the activity log is genuinely useful for support/security review.
 *
 * @param {object} params
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} [params.tx] - pass a transaction client to log atomically with the mutation
 */
async function logActivity({ tx, actorId, action, scope, entityType, entityId, previousValue, newValue, reason, ipAddress }) {
  const client = tx || prisma;
  await client.activityLog.create({
    data: {
      actorId: actorId || null,
      action,
      scope,
      entityType: entityType || null,
      entityId: entityId ? String(entityId) : null,
      previousValue: previousValue ?? undefined,
      newValue: newValue ?? undefined,
      reason: reason || null,
      ipAddress: ipAddress || null,
    },
  });
}

module.exports = { logActivity };
