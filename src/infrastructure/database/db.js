import pg from "pg";
import dotenv from "dotenv";
import { logger } from "../../core/utils/logger.js";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

pool.on("connect", () => {
  logger.info("New database connection established");
});

pool.on("error", (err) => {
  logger.error("Unexpected database error", {
    error: err.message,
    stack: err.stack,
  });
});

/**
 * Test database connection
 */
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();
    logger.info("Database connection successful");
    return true;
  } catch (error) {
    logger.error("Database connection failed", { error: error.message });
    return false;
  }
};

/**
 * Close all connections in the pool
 */
export const closePool = async () => {
  try {
    await pool.end();
    logger.info("Database pool closed");
  } catch (error) {
    logger.error("Error closing database pool", { error: error.message });
  }
};
