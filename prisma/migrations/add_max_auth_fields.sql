-- Shared user row: Telegram + MAX identities, one status/role.
-- Existing rows are Telegram-only: telegram_id is backfilled from user_id.

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_avatar TEXT;

UPDATE users SET telegram_id = user_id WHERE telegram_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_id_key ON users (telegram_id) WHERE telegram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_max_id_key ON users (max_id) WHERE max_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_max_id ON users (max_id);
