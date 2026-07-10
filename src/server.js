const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/db");
const logger = require("./config/logger");
const { startScheduler, stopScheduler } = require("./jobs/scheduler");

const server = app.listen(env.port, () => {
  logger.info(`Veluntra API listening on http://localhost:${env.port}`);
  logger.info(`API docs available at http://localhost:${env.port}/api/docs`);
  startScheduler();
});

async function shutdown() {
  logger.info("Shutting down...");
  stopScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
