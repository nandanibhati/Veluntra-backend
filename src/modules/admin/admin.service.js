const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");
const { logActivity } = require("../../utils/activityLog");

// ---------- Users ----------

async function listUsers(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.role && query.role !== "all") where.role = query.role;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map((u) => toPlain({ ...u, passwordHash: undefined })), page, limit, total };
}

async function setUserStatus(actorId, userId, status, ipAddress) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");

  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  await logActivity({
    actorId,
    action: `${status === "suspended" ? "Suspended" : "Reactivated"} user ${user.name}`,
    scope: "users",
    entityType: "User",
    entityId: userId,
    previousValue: { status: user.status },
    newValue: { status: updated.status },
    ipAddress,
  });
  return toPlain({ ...updated, passwordHash: undefined });
}

// ---------- Sellers (Store approval, suspension, commission) ----------

async function listStores(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.status && query.status !== "all") where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.store.findMany({
      where,
      include: { owner: { select: { name: true, email: true } }, _count: { select: { products: true, orders: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.store.count({ where }),
  ]);
  return {
    items: items.map((s) =>
      toPlain({
        ...s,
        ownerName: s.owner.name,
        ownerEmail: s.owner.email,
        productCount: s._count.products,
        orderCount: s._count.orders,
        owner: undefined,
        _count: undefined,
      })
    ),
    page,
    limit,
    total,
  };
}

async function setStoreStatus(actorId, storeId, status, ipAddress) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw ApiError.notFound("Store not found.");

  const updated = await prisma.store.update({ where: { id: storeId }, data: { status } });
  await logActivity({
    actorId,
    action: `Set store "${store.name}" status to ${status}`,
    scope: "users",
    entityType: "Store",
    entityId: storeId,
    previousValue: { status: store.status },
    newValue: { status },
    ipAddress,
  });
  return toPlain(updated);
}

async function setStoreCommission(actorId, storeId, commissionPercent, ipAddress) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw ApiError.notFound("Store not found.");

  const updated = await prisma.store.update({ where: { id: storeId }, data: { commissionPercent } });
  await logActivity({
    actorId,
    action: `Set store "${store.name}" commission to ${commissionPercent}%`,
    scope: "users",
    entityType: "Store",
    entityId: storeId,
    previousValue: { commissionPercent: store.commissionPercent },
    newValue: { commissionPercent },
    ipAddress,
  });
  return toPlain(updated);
}

async function getCustomerDetail(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");

  const [orders, wishlist, addresses, redemptions] = await Promise.all([
    prisma.order.findMany({ where: { userId }, orderBy: { placedAt: "desc" } }),
    prisma.wishlistItem.findMany({ where: { userId }, include: { product: true } }),
    prisma.address.findMany({ where: { userId } }),
    prisma.couponRedemption.findMany({ where: { userId }, include: { coupon: true } }),
  ]);

  const totalSpent = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  return toPlain({
    ...user,
    passwordHash: undefined,
    orders,
    wishlist,
    addresses,
    couponsUsed: redemptions.map((r) => r.coupon.code),
    totalSpent: Math.round(totalSpent * 100) / 100,
    orderCount: orders.length,
  });
}

async function deleteUser(actorId, userId, ipAddress) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");
  await prisma.user.delete({ where: { id: userId } });
  await logActivity({
    actorId,
    action: `Deleted user ${user.name}`,
    scope: "users",
    entityType: "User",
    entityId: userId,
    previousValue: toPlain({ ...user, passwordHash: undefined }),
    ipAddress,
  });
}

// ---------- Orders (platform-wide) ----------

async function listOrders(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.status && query.status !== "all") where.status = query.status;
  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: "insensitive" } },
      { user: { name: { contains: query.search, mode: "insensitive" } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { name: true } }, items: true },
      orderBy: { placedAt: "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: items.map((o) => toPlain({ ...o, customer: o.user.name, itemCount: o.items.length, user: undefined })),
    page,
    limit,
    total,
  };
}

// ---------- Products (platform-wide) ----------

async function listProducts(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.search) where.name = { contains: query.search, mode: "insensitive" };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, brand: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(toPlain), page, limit, total };
}

// ---------- Activity logs ----------

async function listActivityLogs(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = {};
  if (query.scope && query.scope !== "all") where.scope = query.scope;
  if (query.search) where.action = { contains: query.search, mode: "insensitive" };

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
    items: items.map((l) => toPlain({ ...l, actor: l.actor?.name || "System", actorId: undefined })),
    page,
    limit,
    total,
  };
}

// ---------- Analytics ----------

const TRUNC_BY_PERIOD = { day: "day", week: "week", month: "month" };

async function overview() {
  const [revenueAgg, totalOrders, totalCustomers, refundedCount, profitAgg] = await Promise.all([
    prisma.order.aggregate({ where: { status: { not: "cancelled" } }, _sum: { total: true } }),
    prisma.order.count({ where: { status: { not: "cancelled" } } }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.order.count({ where: { OR: [{ status: "returned" }, { paymentStatus: "refunded" }] } }),
    // Profit = revenue from sold units minus their cost price, summed in the database rather
    // than pulling every order item into Node — this scales with catalog activity, not memory.
    prisma.$queryRaw`
      SELECT
        SUM((oi.price_snapshot - p.cost_price) * oi.quantity)::float AS profit,
        COUNT(p.cost_price) > 0 AS "hasCostData"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.status IN ('delivered', 'shipped', 'processing') AND p.cost_price IS NOT NULL
    `,
  ]);

  const totalRevenue = Number(revenueAgg._sum.total || 0);
  const avgOrderValue = totalOrders ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;
  const refundRate = totalOrders ? Math.round((refundedCount / totalOrders) * 1000) / 10 : 0;
  const { profit, hasCostData } = profitAgg[0] || {};

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    totalCustomers,
    refundRate,
    profit: hasCostData ? Math.round(Number(profit || 0) * 100) / 100 : null,
  };
}

/** `period`: "day" | "week" | "month" — defaults to month. */
async function revenueTrend(period = "month") {
  const trunc = TRUNC_BY_PERIOD[period] || "month";
  const lookback = period === "day" ? "30 days" : period === "week" ? "12 weeks" : "6 months";
  const labelFormat = period === "month" ? "Mon" : "Mon DD";

  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_char(date_trunc('${trunc}', placed_at), '${labelFormat}') AS month,
            date_trunc('${trunc}', placed_at) AS bucket,
            COALESCE(SUM(total), 0)::float AS revenue,
            COUNT(*)::int AS orders
     FROM orders
     WHERE status != 'cancelled' AND placed_at >= (now() - interval '${lookback}')
     GROUP BY date_trunc('${trunc}', placed_at)
     ORDER BY bucket ASC`
  );
  return rows.map(({ bucket, ...rest }) => rest);
}

async function ordersByCategory() {
  const rows = await prisma.$queryRaw`
    SELECT c.name AS category, COUNT(oi.id)::int AS orders
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    GROUP BY c.name
    ORDER BY orders DESC
  `;
  return rows;
}

/** Top products by units sold and revenue — real aggregation from order history, not display placeholders. */
async function topProducts(limit = 10) {
  const rows = await prisma.$queryRaw`
    SELECT p.id, p.name, p.sku, c.name AS category,
           SUM(oi.quantity)::int AS "unitsSold",
           SUM(oi.price_snapshot * oi.quantity)::float AS revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY p.id, p.name, p.sku, c.name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;
  return rows;
}

/** Top categories by revenue. */
async function topCategories(limit = 10) {
  const rows = await prisma.$queryRaw`
    SELECT c.name AS category,
           SUM(oi.price_snapshot * oi.quantity)::float AS revenue,
           SUM(oi.quantity)::int AS "unitsSold"
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY c.name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;
  return rows;
}

/** Seller/store performance ranking — platform-wide view of who's driving revenue. */
async function sellerPerformance(limit = 10) {
  const rows = await prisma.$queryRaw`
    SELECT s.id AS "storeId", s.name AS "storeName",
           COUNT(DISTINCT o.id)::int AS orders,
           COALESCE(SUM(o.total), 0)::float AS revenue
    FROM stores s
    LEFT JOIN orders o ON o.store_id = s.id AND o.status != 'cancelled'
    GROUP BY s.id, s.name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;
  return rows;
}

async function paymentSplit() {
  const rows = await prisma.order.groupBy({
    by: ["paymentMethod"],
    _count: { paymentMethod: true },
    where: { status: { not: "cancelled" } },
  });
  const total = rows.reduce((sum, r) => sum + r._count.paymentMethod, 0) || 1;
  return rows.map((r) => ({
    name: r.paymentMethod,
    value: Math.round((r._count.paymentMethod / total) * 100),
  }));
}

async function customerTrend() {
  const rows = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', created_at), 'Mon') AS month,
           COUNT(*)::int AS "newC"
    FROM users
    WHERE role = 'customer' AND created_at >= (now() - interval '6 months')
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at) ASC
  `;

  const returningRows = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', o.placed_at), 'Mon') AS month,
           COUNT(DISTINCT o.user_id)::int AS returning
    FROM orders o
    WHERE o.placed_at >= (now() - interval '6 months')
      AND EXISTS (
        SELECT 1 FROM orders o2
        WHERE o2.user_id = o.user_id AND o2.placed_at < date_trunc('month', o.placed_at)
      )
    GROUP BY date_trunc('month', o.placed_at)
    ORDER BY date_trunc('month', o.placed_at) ASC
  `;

  const returningByMonth = Object.fromEntries(returningRows.map((r) => [r.month, r.returning]));
  return rows.map((r) => ({ month: r.month, newC: r.newC, returning: returningByMonth[r.month] || 0 }));
}

module.exports = {
  listUsers,
  listStores,
  setStoreStatus,
  setStoreCommission,
  getCustomerDetail,
  setUserStatus,
  deleteUser,
  listOrders,
  listProducts,
  listActivityLogs,
  overview,
  revenueTrend,
  ordersByCategory,
  topProducts,
  topCategories,
  sellerPerformance,
  paymentSplit,
  customerTrend,
};
