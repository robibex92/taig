-- Ролевая модель: users.roles (массив строк) вместо одиночного users.status
-- Словарь ролей см. в src/core/utils/roles.js

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "idx_users_roles" ON "users" USING GIN ("roles");

-- Переносим глобальные роли из устаревшего status
UPDATE "users"
SET "roles" = CASE "status"
  WHEN 'admin'     THEN ARRAY['global:admin']
  WHEN 'moderator' THEN ARRAY['global:moderator']
  WHEN 'activist'  THEN ARRAY['global:activist']
  WHEN 'blocked'   THEN ARRAY['global:blocked']
  WHEN 'blocking'  THEN ARRAY['global:blocked']
  WHEN 'banned'    THEN ARRAY['global:blocked']
  ELSE ARRAY[]::TEXT[]
END
WHERE "roles" = ARRAY[]::TEXT[];

-- Наследованный флаг admins (users.role = true)
UPDATE "users"
SET "roles" = ARRAY['global:admin']::TEXT[] || "roles"
WHERE "role" IS TRUE
  AND NOT ("roles" @> ARRAY['global:admin']::TEXT[]);
