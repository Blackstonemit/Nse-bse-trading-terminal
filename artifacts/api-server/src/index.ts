import "./load-env";
process.env.TZ = "Asia/Kolkata";
import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { initDb } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    logger.info("Initializing SQLite database...");
    await initDb();
    logger.info("SQLite database initialized successfully.");
  } catch (err) {
    logger.error({ err }, "Failed to initialize SQLite database");
    process.exit(1);
  }

  app.listen(port, '127.0.0.1', (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening at http://127.0.0.1:" + port);
    startScheduler();
  });
}

void startServer();
