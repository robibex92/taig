import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log("🚀 Подключение к базе данных...");

    // Проверяем подключение
    await prisma.$connect();
    console.log("✅ Подключение успешно!");

    // Выполняем миграцию по частям
    console.log("📝 Выполнение миграции...");

    // 1. Добавляем image_url в events
    console.log("1. Добавление image_url в events...");
    await prisma.$executeRaw`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "image_url" TEXT;`;
    console.log("✅ image_url добавлен");

    // 2. Изменяем event_registrations для поддержки гостей
    console.log("2. Изменение event_registrations...");
    await prisma.$executeRaw`ALTER TABLE "event_registrations" ALTER COLUMN "user_id" DROP NOT NULL;`;
    await prisma.$executeRaw`ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_name" VARCHAR(255);`;
    await prisma.$executeRaw`ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_phone" VARCHAR(50);`;
    await prisma.$executeRaw`ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_email" VARCHAR(255);`;
    console.log("✅ event_registrations обновлена");

    // 3. Создаем таблицу event_waitlist
    console.log("3. Создание таблицы event_waitlist...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "event_waitlist" (
        "id" BIGSERIAL NOT NULL,
        "event_id" BIGINT NOT NULL,
        "user_id" BIGINT,
        "guest_name" VARCHAR(255),
        "guest_phone" VARCHAR(50),
        "guest_email" VARCHAR(255),
        "notes" TEXT,
        "notified" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "event_waitlist_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log("✅ event_waitlist создана");

    // 4. Создаем таблицу event_telegram_chats
    console.log("4. Создание таблицы event_telegram_chats...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "event_telegram_chats" (
        "id" BIGSERIAL NOT NULL,
        "event_id" BIGINT NOT NULL,
        "telegram_chat_id" INTEGER NOT NULL,
        "message_sent" BOOLEAN NOT NULL DEFAULT false,
        "telegram_message_id" BIGINT,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "event_telegram_chats_pkey" PRIMARY KEY ("id")
      );
    `;
    console.log("✅ event_telegram_chats создана");

    // 5. Добавляем Foreign Keys
    console.log("5. Добавление Foreign Keys...");
    await prisma.$executeRaw`ALTER TABLE "event_waitlist" ADD CONSTRAINT "event_waitlist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;`;
    await prisma.$executeRaw`ALTER TABLE "event_waitlist" ADD CONSTRAINT "event_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;`;
    await prisma.$executeRaw`ALTER TABLE "event_telegram_chats" ADD CONSTRAINT "event_telegram_chats_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;`;
    await prisma.$executeRaw`ALTER TABLE "event_telegram_chats" ADD CONSTRAINT "event_telegram_chats_telegram_chat_id_fkey" FOREIGN KEY ("telegram_chat_id") REFERENCES "telegram_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;`;
    console.log("✅ Foreign Keys добавлены");

    // 6. Создаем индексы
    console.log("6. Создание индексов...");
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "event_waitlist_event_id_idx" ON "event_waitlist"("event_id");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "event_waitlist_user_id_idx" ON "event_waitlist"("user_id");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "event_waitlist_notified_idx" ON "event_waitlist"("notified");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "event_telegram_chats_event_id_idx" ON "event_telegram_chats"("event_id");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "event_telegram_chats_telegram_chat_id_idx" ON "event_telegram_chats"("telegram_chat_id");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "event_telegram_chats_event_id_telegram_chat_id_key" ON "event_telegram_chats"("event_id", "telegram_chat_id");`;
    console.log("✅ Индексы созданы");

    // 7. Обновляем purpose в telegram_chats
    console.log("7. Обновление purpose в telegram_chats...");
    await prisma.$executeRaw`ALTER TABLE "telegram_chats" ALTER COLUMN "purpose" TYPE VARCHAR(50);`;
    console.log("✅ purpose обновлен");

    console.log("🎉 Миграция выполнена успешно!");
  } catch (error) {
    console.error("❌ Ошибка миграции:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch(console.error);
