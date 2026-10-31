-- Migration: АВТООТВЕТЫ по ключевым словам и НАПОМИНАНИЯ в чатах
-- Оба канала: Telegram-бот и MAX-бот читают сообщения групповых чатов, в которые
-- они добавлены, и отвечают по настроенным админкой условиям (chat_auto_replies).
-- Напоминания (chat_reminders) — плановые сообщения в конкретный чат.
-- Схема: prisma/schema.prisma -> ChatAutoReply / ChatReminder

-- 1. Условия автоответа: «если в чате написали фразу — ответить текстом».
CREATE TABLE IF NOT EXISTS "chat_auto_replies" (
  "id"         BIGSERIAL PRIMARY KEY,
  "platform"   VARCHAR(16) NOT NULL,
  "phrase"     TEXT NOT NULL,
  "response"   TEXT NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_auto_replies_platform_check"
    CHECK ("platform" IN ('telegram', 'max')),
  -- Одна и та же фраза не может быть заведена дважды на одном канале: два
  -- одинаковых условия — это два одинаковых ответа подряд.
  CONSTRAINT "chat_auto_replies_platform_phrase_key"
    UNIQUE ("platform", "phrase")
);

-- Список админки всегда читается как «активные условия такого-то канала».
CREATE INDEX IF NOT EXISTS "idx_chat_auto_replies_active"
  ON "chat_auto_replies" ("platform", "is_active");

-- 2. Напоминания: раз в день / по дням недели / раз в месяц (в том числе
-- «последний день месяца») в заданное время, в конкретный чат канала.
CREATE TABLE IF NOT EXISTS "chat_reminders" (
  "id"                  BIGSERIAL PRIMARY KEY,
  "platform"            VARCHAR(16) NOT NULL,
  -- id записи реестра чатов: telegram_chats.id для 'telegram', max_chats.id для
  -- 'max'. Внешнего ключа нет сознательно: на какой реестр ссылаться, зависит от
  -- platform, а адрес при отправке всё равно резолвится на сервере.
  "chat_record_id"      BIGINT NOT NULL,
  "text"                TEXT NOT NULL,
  "schedule_kind"       VARCHAR(16) NOT NULL,
  "time_of_day"         VARCHAR(5) NOT NULL,
  -- Для 'weekly': список дней недели через запятую, 1 = понедельник … 7 = воскресенье.
  "weekdays"            VARCHAR(20),
  -- Для 'monthly': число месяца 1..31; если включён last_day_of_month — число не важен.
  "day_of_month"        SMALLINT,
  "last_day_of_month"   BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active"           BOOLEAN NOT NULL DEFAULT TRUE,
  -- Ключ уже отправленного срабатывания ('2026-10-31T10:00' для дня,
  -- '2026-10T10:00' для месяца). По нему планировщик не дублирует напоминание
  -- после рестарта процесса и успевает догнать пропущенное.
  "last_occurrence_key" TEXT,
  "last_result"         VARCHAR(16),
  "last_error"          TEXT,
  "last_sent_at"        TIMESTAMPTZ,
  "failed_attempts"     SMALLINT NOT NULL DEFAULT 0,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_reminders_platform_check"
    CHECK ("platform" IN ('telegram', 'max')),
  CONSTRAINT "chat_reminders_schedule_check"
    CHECK ("schedule_kind" IN ('daily', 'weekly', 'monthly')),
  -- Время хранится как локальное в поясе REMINDER_TZ, поэтому формат строгий.
  CONSTRAINT "chat_reminders_time_check"
    CHECK ("time_of_day" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "chat_reminders_day_of_month_check"
    CHECK ("day_of_month" IS NULL OR ("day_of_month" BETWEEN 1 AND 31)),
  CONSTRAINT "chat_reminders_last_result_check"
    CHECK ("last_result" IS NULL OR "last_result" IN ('sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS "idx_chat_reminders_active"
  ON "chat_reminders" ("is_active");
