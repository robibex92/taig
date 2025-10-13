import { prisma } from "../src/infrastructure/database/db.js";

async function createTelegramChatsTable() {
  try {
    console.log("Creating telegram_chats table...");

    // Create telegram_chats table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS telegram_chats (
          id SERIAL PRIMARY KEY,
          chat_id VARCHAR(255) NOT NULL,
          thread_id VARCHAR(255),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          chat_type VARCHAR(50) NOT NULL DEFAULT 'group',
          is_active BOOLEAN NOT NULL DEFAULT true,
          purpose VARCHAR(50) NOT NULL DEFAULT 'general',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chat_id, thread_id)
      );
    `);

    console.log("✅ Table telegram_chats created");

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_telegram_chats_purpose ON telegram_chats(purpose);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_telegram_chats_is_active ON telegram_chats(is_active);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_telegram_chats_chat_id ON telegram_chats(chat_id);
    `);

    console.log("✅ Indexes created");

    // Insert existing chats
    await prisma.$executeRawUnsafe(`
      INSERT INTO telegram_chats (chat_id, thread_id, name, description, chat_type, is_active, purpose) VALUES
      -- Ads chats
      ('-1001922890501', '1588', 'Купи продай тайгинский парк.', 'Чат купи/продай (двух домов ЖК)', 'group', true, 'ads'),
      ('-1001935812136', '5541', 'Купи/продай, отдам даром', 'Чат купи/продай (39 дом)', 'group', true, 'ads'),

      -- News chats
      ('-1001922890501', NULL, 'Болталка двух домов', 'Чат болталки (двух домов ЖК)', 'group', true, 'news'),
      ('-1001935812136', '5543', 'Общие вопросы дома 39', 'Чат Общие вопросы (39 дом)', 'group', true, 'news'),
      ('-1001992407628', NULL, 'Чат 2 секции', 'Чат 2 секции (39 дом)', 'group', true, 'news'),
      ('-4611904517', NULL, 'Чат 4 секции', 'Чат 4 секции (39 дом)', 'group', true, 'news'),
      ('-1002030238237', NULL, 'Чат 7 секции', 'Чат 7 секции (39 дом)', 'group', true, 'news'),

      -- General/Test chats
      ('-1002609427061', NULL, 'general чат', 'general чат в тестовой группе', 'group', true, 'general'),
      ('-1002609427061', '2', 'Купи/продай тестовый', 'Купи/продай, отдам даром чат в тестовой группе', 'group', true, 'general'),
      ('-1002609427061', '3', 'Новости тестовый', 'Новости чат в тестовой группе', 'group', true, 'general')
      ON CONFLICT (chat_id, thread_id) DO NOTHING;
    `);

    console.log("✅ Initial data inserted");

    // Create trigger
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION update_telegram_chats_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS telegram_chats_updated_at ON telegram_chats;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER telegram_chats_updated_at
      BEFORE UPDATE ON telegram_chats
      FOR EACH ROW
      EXECUTE FUNCTION update_telegram_chats_updated_at();
    `);

    console.log("✅ Trigger created");

    // Verify data
    const count = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM telegram_chats;`
    );
    console.log(`✅ Total chats in DB: ${count[0].count}`);

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTelegramChatsTable();
