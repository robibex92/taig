import { prisma } from "../src/infrastructure/database/prisma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log("🚀 Applying Events migration...");

    const migrationPath = path.join(
      __dirname,
      "../prisma/migrations/add_events_system.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split SQL by statements and execute each
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await prisma.$executeRawUnsafe(statement);
    }

    console.log("✅ Migration applied successfully!");
    console.log("📊 Testing connection to events table...");

    // Test that the tables were created
    const eventsCount = await prisma.event.count();
    const registrationsCount = await prisma.eventRegistration.count();

    console.log(`✅ Events table: ${eventsCount} records`);
    console.log(`✅ Event Registrations table: ${registrationsCount} records`);
    console.log("🎉 System ready for events!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.message.includes("already exists")) {
      console.log("⚠️ Tables already exist, skipping migration");
    } else {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
