const prisma = require("../../config/db");

/** Public, homepage-facing platform stats — every number is a real aggregate, never a hardcoded constant. */
async function getPublicStats() {
  const [happyCustomers, productsDeliveredAgg, ratingAgg, countryRows] = await Promise.all([
    prisma.user.count({ where: { role: "customer" } }),
    prisma.orderItem.aggregate({
      where: { order: { status: "delivered" } },
      _sum: { quantity: true },
    }),
    prisma.product.aggregate({ where: { ratingCount: { gt: 0 } }, _avg: { ratingAvg: true } }),
    prisma.$queryRaw`
      SELECT DISTINCT a.country
      FROM orders o
      JOIN addresses a ON a.id = o.shipping_address_id
    `,
  ]);

  return {
    happyCustomers,
    productsDelivered: productsDeliveredAgg._sum.quantity || 0,
    countriesServed: countryRows.length,
    averageRating: ratingAgg._avg.ratingAvg ? Math.round(ratingAgg._avg.ratingAvg * 10) / 10 : 0,
  };
}

module.exports = { getPublicStats };
