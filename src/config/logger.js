const pino = require("pino");
const env = require("./env");

// pino-pretty is a devDependency, deliberately absent from the production image (the shared
// Dockerfile always runs `npm install --omit=dev`, for both Render and local docker-compose —
// docker-compose sets NODE_ENV=development for local runs, so checking env.isProduction alone
// would still try to load pino-pretty inside that container and crash on boot). Checking real
// module availability instead of trusting NODE_ENV is what actually makes this safe everywhere.
function prettyTransportIfAvailable() {
  try {
    require.resolve("pino-pretty");
    return { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } };
  } catch {
    return undefined;
  }
}

/** Central structured logger. Pretty-printed when pino-pretty is installed (local dev); plain
 * JSON otherwise (any environment where only production dependencies were installed). */
const logger = pino({
  level: process.env.LOG_LEVEL || (env.isProduction ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.token",
      "*.refreshToken",
      "*.accessToken",
    ],
    remove: true,
  },
  transport: prettyTransportIfAvailable(),
});

module.exports = logger;
