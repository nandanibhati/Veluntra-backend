const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const logger = require("../config/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.code === "P2002") {
    // Prisma unique constraint violation
    return res.status(409).json({
      success: false,
      error: { message: "A record with this value already exists.", fields: err.meta?.target },
    });
  }
  if (err && err.code === "P2025") {
    return res.status(404).json({ success: false, error: { message: "Record not found." } });
  }

  const statusCode = err instanceof ApiError ? err.statusCode : err.statusCode || 500;
  const message = statusCode === 500 && env.nodeEnv === "production" ? "Internal server error" : err.message;

  if (statusCode === 500) {
    (req.log || logger).error({ err, path: req.originalUrl, method: req.method }, "Unhandled error");
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
