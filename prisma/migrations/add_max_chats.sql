-- Migration: Реестр MAX-чатов и журнал публикаций объявлений
--
-- Telegram-чаты живут в `telegram_chats` с 2026 года и выборка целей публикации
-- идёт по ним. Для MAX такой таблицы не было: `MaxBotService` умеет писать только
-- в личный диалог (`POST /messages?user_id=`), поэтому дублировать объявление в
-- MAX-чат было некуда и нечем.
--
-- Применяется с этой машины или с сервера — `backend_user` создаёт таблицы сам:
--   npx prisma db execute --file prisma/migrations/add_max_chats.sql
--   npx prisma generate
--
-- ВАЖНО про `max_messages`: такой таблицей хотел писать предыдущий заход
-- (`add_max_integration.sql`), но она не отображена в Prisma, `entity_id` там
-- INTEGER (id объявления — BIGINT), и код в неё не пишет. Здесь заводится
-- отдельный журнал `max_ad_messages` с честными типами; старая `max_messages`
-- остаётся мёртвой и удаляется отдельно, по решению пользователя.

-- 1. Реестр чатов. `chat_id` — настоящий идентификатор чата в MAX (int64),
--    `id` — внутренняя запись, по ней фронт выбирает чаты при публикации.
CREATE TABLE IF NOT EXISTS max_chats (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    chat_type VARCHAR(50) NOT NULL DEFAULT 'CHAT',
    purpose VARCHAR(50) NOT NULL DEFAULT 'ads',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    visible_to_all BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_max_chats_is_active ON max_chats (is_active);
CREATE INDEX IF NOT EXISTS idx_max_chats_purpose ON max_chats (purpose);
CREATE INDEX IF NOT EXISTS idx_max_chats_visible_to_all ON max_chats (visible_to_all);

COMMENT ON COLUMN max_chats.purpose IS
    'ads — объявления, news — новости, general — прочее; как в telegram_chats';
COMMENT ON COLUMN max_chats.visible_to_all IS
    'false — чат виден в списке выбора только moderator/global:admin';

-- 2. Журнал: одно объявление — одна строка на чат. Нужен, чтобы repost и
--    архивация снимали старые посты, а не плодили дубли.
CREATE TABLE IF NOT EXISTS max_ad_messages (
    id BIGSERIAL PRIMARY KEY,
    ad_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    message_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),

    CONSTRAINT uq_max_ad_messages_ad_chat UNIQUE (ad_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_max_ad_messages_ad_id ON max_ad_messages (ad_id);

COMMENT ON COLUMN max_ad_messages.message_id IS
    'Идентификатор сообщения, который вернул MAX API; храним строкой — в ответах он встречается и числом, и хешем';
