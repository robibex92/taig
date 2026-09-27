-- Migration: Одноразовые хендоверы MAX-авторизации в БД
--
-- `loginCode` и `requestId` жили в `Map` внутри процесса: второй инстанс PM2 или
-- рестарт между «войти из мини-аппа» и «забрать сессию в браузере» давали
-- «Login request not found or expired» на ровном месте.
--
-- Применяется от привилегированной роли (у backend_user прав на CREATE TABLE нет
-- только у чужих таблиц; эту таблицу он может создать и сам):
--   cat prisma/migrations/add_auth_handoffs.sql | sudo -u postgres psql -d mydatabase
--
-- ВАЖНО: применять до выката кода — иначе MAX-логин упадёт с «table does not exist».

CREATE TABLE IF NOT EXISTS auth_handoffs (
    id BIGSERIAL PRIMARY KEY,
    kind VARCHAR(16) NOT NULL,
    key VARCHAR(128) NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMPTZ(6) NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),

    CONSTRAINT uq_auth_handoffs_kind_key UNIQUE (kind, key),
    CONSTRAINT fk_auth_handoffs_user_id
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_handoffs_expires_at
    ON auth_handoffs (expires_at);
