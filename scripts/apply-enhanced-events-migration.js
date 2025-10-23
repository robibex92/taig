import { prisma } from "../src/infrastructure/database/prisma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  try {
    console.log("🚀 Применение расширенной миграции событий...");

    const migrationPath = path.join(
      __dirname,
      "../prisma/migrations/enhance_events_system.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split SQL by statements and execute each
    // First, normalize line endings and remove comments
    const normalizedSQL = migrationSQL
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = normalizedSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      const preview = statement.substring(0, 80).replace(/\n/g, " ");
      console.log(`Выполнение: ${preview}...`);
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ Успешно`);
      } catch (error) {
        // Ignore "already exists" errors
        if (
          error.message.includes("already exists") ||
          error.message.includes("duplicate column") ||
          error.message.includes("constraint") && error.message.includes("already exists")
        ) {
          console.log(`⚠️  Пропущено (уже существует)`);
        } else {
          console.error(`❌ Ошибка: ${error.message}`);
          throw error;
        }
      }
    }

    console.log("✅ Миграция применена успешно!");
    console.log("📊 Проверка новых таблиц...");

    // Test new tables
    try {
      const waitlistCount = await prisma.eventWaitlist.count();
      console.log(`✅ Таблица event_waitlist: ${waitlistCount} записей`);
    } catch (e) {
      console.warn("⚠️  Таблица event_waitlist недоступна");
    }

    try {
      const eventTelegramCount = await prisma.eventTelegramChat.count();
      console.log(
        `✅ Таблица event_telegram_chats: ${eventTelegramCount} записей`
      );
    } catch (e) {
      console.warn("⚠️  Таблица event_telegram_chats недоступна");
    }

    console.log("🎉 Система событий готова!");
  } catch (error) {
    console.error("❌ Ошибка миграции:", error.message);
    if (error.code) {
      console.error("Код ошибки:", error.code);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
