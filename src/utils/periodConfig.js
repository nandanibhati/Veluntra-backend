/**
 * Single source of truth for the "day" | "week" | "month" revenue-trend period, consumed by
 * admin.service.js and seller.service.js's revenueTrend() — both build a raw SQL string
 * (date_trunc/interval can't be bound as query params in Postgres, hence $queryRawUnsafe) from
 * these three derived values. Collapsing what used to be a lookup map plus two separate
 * ternaries into one object means there is exactly one place `period` maps to anything that
 * reaches the SQL string — an unrecognized period falls back to "month" here, never interpolated
 * raw. Do NOT add a new field to a config entry that isn't drawn from this fixed set of keys.
 */
const PERIOD_CONFIG = {
  day: { trunc: "day", lookback: "30 days", labelFormat: "Mon DD" },
  week: { trunc: "week", lookback: "12 weeks", labelFormat: "Mon DD" },
  month: { trunc: "month", lookback: "6 months", labelFormat: "Mon" },
};

function resolvePeriodConfig(period) {
  return PERIOD_CONFIG[period] || PERIOD_CONFIG.month;
}

module.exports = { PERIOD_CONFIG, resolvePeriodConfig };
