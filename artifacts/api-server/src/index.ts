import app from "./app";
import { logger } from "./lib/logger";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    await pool.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('free_slots_used', '10')
      ON CONFLICT (key) DO NOTHING
    `);
    logger.info("Database seeded: app_settings initialized");
  } catch (err) {
    logger.warn({ err }, "DB seed step failed (non-fatal)");
  } finally {
    await pool.end();
  }
}

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

seedDatabase().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
