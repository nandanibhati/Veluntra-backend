const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");

/**
 * Resolves which store the Seller Dashboard should manage for the current user.
 * A real seller always owns exactly one store. Admin/Super Admin don't own a store
 * themselves, but while the platform only has one store total, they're allowed to
 * manage it directly from here too — this is a "there's currently only one seller"
 * convenience, not a general multi-store admin picker.
 */
async function getStoreForOwner(ownerId, role) {
  const owned = await prisma.store.findUnique({ where: { ownerId } });
  if (owned) return owned;

  if (role === "admin" || role === "superadmin") {
    const stores = await prisma.store.findMany({ take: 2 });
    if (stores.length === 1) return stores[0];
    if (stores.length > 1) {
      throw ApiError.badRequest("Multiple stores exist on the platform — manage them individually from Admin > Sellers instead.");
    }
  }
  throw ApiError.badRequest("You don't have a store yet.");
}

async function overview(storeId) {
  const [revenueAgg, totalOrders, products, refundedCount, profitAgg] = await Promise.all([
    prisma.order.aggregate({ where: { storeId, status: { not: "cancelled" } }, _sum: { total: true } }),
    prisma.order.count({ where: { storeId, status: { not: "cancelled" } } }),
    prisma.product.findMany({ where: { storeId }, select: { stock: true } }),
    prisma.order.count({ where: { storeId, OR: [{ status: "returned" }, { paymentStatus: "refunded" }] } }),
    // Summed in the database rather than pulling every order item into Node (see admin.service.js).
    prisma.$queryRaw`
      SELECT
        SUM((oi.price_snapshot - p.cost_price) * oi.quantity)::float AS profit,
        COUNT(p.cost_price) > 0 AS "hasCostData"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.store_id = ${storeId} AND o.status IN ('delivered', 'shipped', 'processing') AND p.cost_price IS NOT NULL
    `,
  ]);

  const totalRevenue = Number(revenueAgg._sum.total || 0);
  const avgOrderValue = totalOrders ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;
  const refundRate = totalOrders ? Math.round((refundedCount / totalOrders) * 1000) / 10 : 0;
  const stockCounts = products.reduce(
    (acc, p) => {
      if (p.stock === 0) acc.out += 1;
      else if (p.stock <= 10) acc.low += 1;
      else acc.in += 1;
      return acc;
    },
    { in: 0, low: 0, out: 0 }
  );

  const { profit, hasCostData } = profitAgg[0] || {};

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    productCount: products.length,
    stockCounts,
    refundRate,
    profit: hasCostData ? Math.round(Number(profit || 0) * 100) / 100 : null,
  };
}

async function revenueTrend(storeId, period = "month") {
  const trunc = { day: "day", week: "week", month: "month" }[period] || "month";
  const lookback = period === "day" ? "30 days" : period === "week" ? "12 weeks" : "6 months";
  const labelFormat = period === "month" ? "Mon" : "Mon DD";

  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_char(date_trunc('${trunc}', placed_at), '${labelFormat}') AS label,
            date_trunc('${trunc}', placed_at) AS bucket,
            COALESCE(SUM(total), 0)::float AS revenue,
            COUNT(*)::int AS orders
     FROM orders
     WHERE store_id = $1 AND status != 'cancelled' AND placed_at >= (now() - interval '${lookback}')
     GROUP BY date_trunc('${trunc}', placed_at)
     ORDER BY bucket ASC`,
    storeId
  );
  return rows.map(({ bucket, ...rest }) => rest);
}

/** Top products for this store, by units sold and revenue. */
async function topProducts(storeId, limit = 10) {
  const rows = await prisma.$queryRaw`
    SELECT p.id, p.name, p.sku,
           SUM(oi.quantity)::int AS "unitsSold",
           SUM(oi.price_snapshot * oi.quantity)::float AS revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId} AND o.status != 'cancelled'
    GROUP BY p.id, p.name, p.sku
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;
  return rows;
}

async function categorySales(storeId) {
  const rows = await prisma.$queryRaw`
    SELECT c.name AS category, COALESCE(SUM(oi.price_snapshot * oi.quantity), 0)::float AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE o.store_id = ${storeId} AND o.status != 'cancelled'
    GROUP BY c.name
    ORDER BY revenue DESC
  `;
  return rows;
}

async function listProducts(storeId, query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = { storeId };
  if (query.search) where.name = { contains: query.search, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: { category: true, brand: true }, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(toPlain), page, limit, total };
}

async function listOrders(storeId, query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const where = { storeId };
  if (query.status && query.status !== "all") where.status = query.status;

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

/** Customers derived from this store's order history (no separate "customer" table needed). */
async function listCustomers(storeId) {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.name, u.email,
           COUNT(o.id)::int AS orders,
           COALESCE(SUM(o.total), 0)::float AS spent
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.store_id = ${storeId} AND o.status != 'cancelled'
    GROUP BY u.id, u.name, u.email
    ORDER BY spent DESC
  `;
  return rows.map((r) => ({
    ...r,
    segment: r.spent > 2000 ? "VIP" : r.orders > 1 ? "Returning" : "New",
  }));
}

module.exports = {
  getStoreForOwner,
  overview,
  revenueTrend,
  categorySales,
  topProducts,
  listProducts,
  listOrders,
  listCustomers,
};
