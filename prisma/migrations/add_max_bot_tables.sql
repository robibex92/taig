-- Migration: MAX BOT — рассылки и входящие обращения жителей
-- Модуль админки «MAX-бот» (src/presentation/controllers/MaxBotController.js)
-- Схема: prisma/schema.prisma -> MaxBotInboxMessage / MaxBotBroadcast /
--        MaxBotBroadcastRecipient / MaxBotState

-- 1. Входящие/исходящие сообщения диалогов с ботом
CREATE TABLE IF NOT EXISTS "max_bot_inbox_messages" (
  "id"           BIGSERIAL PRIMARY KEY,
  "direction"    VARCHAR(8) NOT NULL DEFAULT 'in',
  "max_user_id"  BIGINT NOT NULL,
  "user_id"      BIGINT,
  "display_name" VARCHAR(255),
  "username"     VARCHAR(255),
  "text"         TEXT NOT NULL,
  "received_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "marker"       BIGINT,
  "is_handled"   BOOLEAN NOT NULL DEFAULT FALSE,
  "handled_by"   BIGINT,
  "handled_at"   TIMESTAMPTZ,
  "note"         TEXT,
  CONSTRAINT "max_bot_inbox_messages_direction_check"
    CHECK ("direction" IN ('in', 'out')),
  -- marker = курсор события GET /updates: один и тот же событие не может
  -- сохраниться дважды (NULL допустим — исходящие сообщения курса не имеют)
  CONSTRAINT "max_bot_inbox_messages_marker_key" UNIQUE ("marker"),
  CONSTRAINT "max_bot_inbox_messages_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_max_bot_inbox_received_at"
  ON "max_bot_inbox_messages" ("received_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_max_bot_inbox_is_handled"
  ON "max_bot_inbox_messages" ("is_handled");
CREATE INDEX IF NOT EXISTS "idx_max_bot_inbox_max_user_id"
  ON "max_bot_inbox_messages" ("max_user_id");

-- 2. Рассылки
CREATE TABLE IF NOT EXISTS "max_bot_broadcasts" (
  "id"          BIGSERIAL PRIMARY KEY,
  "text"        TEXT NOT NULL,
  "audience"    VARCHAR(255) NOT NULL,
  "status"      VARCHAR(16) NOT NULL DEFAULT 'draft',
  "total"       INTEGER NOT NULL DEFAULT 0,
  "sent"        INTEGER NOT NULL DEFAULT 0,
  "failed"      INTEGER NOT NULL DEFAULT 0,
  "skipped"     INTEGER NOT NULL DEFAULT 0,
  "created_by"  BIGINT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "started_at"  TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "error"       TEXT,
  CONSTRAINT "max_bot_broadcasts_status_check"
    CHECK ("status" IN ('draft', 'queued', 'running', 'completed', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS "idx_max_bot_broadcasts_status"
  ON "max_bot_broadcasts" ("status");
CREATE INDEX IF NOT EXISTS "idx_max_bot_broadcasts_created_at"
  ON "max_bot_broadcasts" ("created_at" DESC);

-- 3. Очередь получателей рассылки
CREATE TABLE IF NOT EXISTS "max_bot_broadcast_recipients" (
  "id"           BIGSERIAL PRIMARY KEY,
  "broadcast_id" BIGINT NOT NULL,
  "user_id"      BIGINT,
  "max_id"       BIGINT NOT NULL,
  "status"       VARCHAR(16) NOT NULL DEFAULT 'pending',
  "error"        TEXT,
  "sent_at"      TIMESTAMPTZ,
  CONSTRAINT "max_bot_broadcast_recipients_bc_max_key"
    UNIQUE ("broadcast_id", "max_id"),
  CONSTRAINT "max_bot_broadcast_recipients_status_check"
    CHECK ("status" IN ('pending', 'sent', 'failed', 'skipped')),
  CONSTRAINT "max_bot_broadcast_recipients_broadcast_fkey"
    FOREIGN KEY ("broadcast_id") REFERENCES "max_bot_broadcasts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_max_bot_recipients_broadcast_status"
  ON "max_bot_broadcast_recipients" ("broadcast_id", "status");

-- 4. Состояние бота (курсор /updates и пр.)
CREATE TABLE IF NOT EXISTS "max_bot_state" (
  "key"   VARCHAR(64) PRIMARY KEY,
  "value" TEXT NOT NULL
);

-- 5. Документирование
COMMENT ON TABLE "max_bot_inbox_messages" IS
  'Диалог жителей с MAX-ботом: direction=in — входящее, out — ответ администратора';
COMMENT ON COLUMN "max_bot_inbox_messages"."marker" IS
  'Курсор события GET /updates, ключ дедупликации';
COMMENT ON COLUMN "max_bot_inbox_messages"."user_id" IS
  'Совпавший локальный аккаунт по users.max_id';
COMMENT ON TABLE "max_bot_broadcasts" IS
  'Рассылка текста через MAX-бота по аудитории (all_max | role:<r> | house:<n>)';
COMMENT ON COLUMN "max_bot_broadcasts"."skipped" IS
  'Получатели без диалога с ботом (dialog.not.found) — не считается ошибкой';
COMMENT ON TABLE "max_bot_state" IS
  'Ключ/value состояние MAX-бота, ключ "updates_marker" — курсор long polling';
