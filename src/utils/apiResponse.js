/**
 * Standard success envelope used by every endpoint, so both the web
 * frontend and any future mobile client can parse responses uniformly.
 *
 *   { success: true, data, meta? }
 */
function sendSuccess(res, { data = null, meta, statusCode = 200 } = {}) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = { sendSuccess, paginationMeta };
