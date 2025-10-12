#!/usr/bin/env node
/**
 * Apply SQL migration to database
 * Usage: node apply_migration.js <path_to_sql_file>
 */

import { readFileSync } from "fs";
import pkg from "pg";
const { Client } = pkg;
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

async function applyMigration(sqlFilePath) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔌 Connecting to database...");
    await client.connect();
    console.log("✅ Connected!");

    // Read SQL file
    const sqlPath = resolve(__dirname, sqlFilePath);
    console.log(`📖 Reading migration from: ${sqlPath}`);
    const sql = readFileSync(sqlPath, "utf8");

    // Execute migration
    console.log("🚀 Applying migration...");
    await client.query(sql);
    console.log("✅ Migration applied successfully!");
  } catch (error) {
    console.error("❌ Error applying migration:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Get SQL file path from command line argument
const sqlFile = process.argv[2] || "prisma/migrations/add_refresh_tokens.sql";

applyMigration(sqlFile);
