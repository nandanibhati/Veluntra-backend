const { PrismaClient } = require("@prisma/client");
const env = require("./env");

// Single shared Prisma client instance for the whole process.
const prisma = new PrismaClient({
  log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
