-- Добавить image_url в events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- Изменить event_registrations для поддержки гостей
ALTER TABLE "event_registrations" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_name" VARCHAR(255);
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_phone" VARCHAR(50);
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_email" VARCHAR(255);

-- Создать таблицу event_waitlist
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

-- Создать таблицу event_telegram_chats (Many-to-Many связь)
CREATE TABLE IF NOT EXISTS "event_telegram_chats" (
    "id" BIGSERIAL NOT NULL,
    "event_id" BIGINT NOT NULL,
    "telegram_chat_id" INTEGER NOT NULL,
    "message_sent" BOOLEAN NOT NULL DEFAULT false,
    "telegram_message_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_telegram_chats_pkey" PRIMARY KEY ("id")
);

-- Добавить Foreign Keys для event_waitlist
ALTER TABLE "event_waitlist" ADD CONSTRAINT "event_waitlist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_waitlist" ADD CONSTRAINT "event_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Добавить Foreign Keys для event_telegram_chats
ALTER TABLE "event_telegram_chats" ADD CONSTRAINT "event_telegram_chats_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_telegram_chats" ADD CONSTRAINT "event_telegram_chats_telegram_chat_id_fkey" FOREIGN KEY ("telegram_chat_id") REFERENCES "telegram_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Создать индексы для event_waitlist
CREATE INDEX IF NOT EXISTS "event_waitlist_event_id_idx" ON "event_waitlist"("event_id");
CREATE INDEX IF NOT EXISTS "event_waitlist_user_id_idx" ON "event_waitlist"("user_id");
CREATE INDEX IF NOT EXISTS "event_waitlist_notified_idx" ON "event_waitlist"("notified");

-- Создать индексы для event_telegram_chats
CREATE INDEX IF NOT EXISTS "event_telegram_chats_event_id_idx" ON "event_telegram_chats"("event_id");
CREATE INDEX IF NOT EXISTS "event_telegram_chats_telegram_chat_id_idx" ON "event_telegram_chats"("telegram_chat_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_telegram_chats_event_id_telegram_chat_id_key" ON "event_telegram_chats"("event_id", "telegram_chat_id");

