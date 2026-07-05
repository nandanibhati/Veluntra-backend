/** Parses ?page & ?limit query params into safe { page, limit, skip, take }. */
function parsePagination(query, { defaultLimit = 12, maxLimit = 60 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

module.exports = { parsePagination };
