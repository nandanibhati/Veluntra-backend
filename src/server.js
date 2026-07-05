const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/db");
const { startScheduler, stopScheduler } = require("./jobs/scheduler");

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Veluntra API listening on http://localhost:${env.port}`);
  // eslint-disable-next-line no-console
  console.log(`API docs available at http://localhost:${env.port}/api/docs`);
  startScheduler();
});

async function shutdown() {
  // eslint-disable-next-line no-console
  console.log("Shutting down...");
  stopScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
