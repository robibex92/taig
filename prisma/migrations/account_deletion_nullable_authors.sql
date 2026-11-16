-- Migration: обезличивание контента при удалении аккаунта
--
-- DELETE /api/users/me (режим anonymize) оставляет объявления, комментарии
-- и события на витрине, отвязывая их от автора. Для этого author_id/created_by
-- должны допускать NULL. Применяется от привилегированной роли ДО выката кода:
--   cat prisma/migrations/account_deletion_nullable_authors.sql | sudo -u postgres psql -d mydatabase
--
-- Идемпотентна: DROP NOT NULL на уже nullable-колонке не ошибается.

ALTER TABLE house_comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE entrance_comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN created_by DROP NOT NULL;