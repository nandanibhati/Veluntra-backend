const prisma = require("../../config/db");
const { logActivity } = require("../../utils/activityLog");
const { PERMISSION_KEYS, CONFIGURABLE_ROLES, DEFAULT_PERMISSIONS } = require("./permissions.constants");

/** `superadmin` is never stored — it always has every permission. */
async function isAllowed(role, permission) {
  if (role === "superadmin") return true;
  const row = await prisma.rolePermission.findUnique({ where: { role_permission: { role, permission } } });
  if (row) return row.allowed;
  return DEFAULT_PERMISSIONS[role]?.[permission] ?? false;
}

/** Full grid for the admin UI: every configurable role x every permission key, DB overrides merged over defaults. */
async function getGrid() {
  const rows = await prisma.rolePermission.findMany();
  const overrides = {};
  for (const row of rows) {
    overrides[row.role] = overrides[row.role] || {};
    overrides[row.role][row.permission] = row.allowed;
  }
  return CONFIGURABLE_ROLES.map((role) => ({
    role,
    permissions: Object.fromEntries(
      PERMISSION_KEYS.map((key) => [key, overrides[role]?.[key] ?? DEFAULT_PERMISSIONS[role]?.[key] ?? false])
    ),
  }));
}

async function setPermission(role, permission, allowed, { actorId, ipAddress, reason }) {
  const existing = await prisma.rolePermission.findUnique({ where: { role_permission: { role, permission } } });
  const previousAllowed = existing ? existing.allowed : DEFAULT_PERMISSIONS[role]?.[permission] ?? false;

  const updated = await prisma.rolePermission.upsert({
    where: { role_permission: { role, permission } },
    update: { allowed },
    create: { role, permission, allowed },
  });
  await logActivity({
    actorId,
    action: `Set permission "${permission}" for role "${role}" to ${allowed}`,
    scope: "roles",
    entityType: "RolePermission",
    entityId: updated.id,
    previousValue: { role, permission, allowed: previousAllowed },
    newValue: { role, permission, allowed },
    reason,
    ipAddress,
  });
  return updated;
}

async function bulkSet(items, ctx) {
  for (const { role, permission, allowed } of items) {
    await setPermission(role, permission, allowed, ctx);
  }
  return getGrid();
}

module.exports = { isAllowed, getGrid, setPermission, bulkSet, PERMISSION_KEYS };
