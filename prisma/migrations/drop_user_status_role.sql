-- Зачистка после перехода на users.roles (см. add_user_roles.sql).
-- Применять ТОЛЬКО когда убедитесь, что новый код работает и права выдаются корректно:
--     SELECT status, role, count(*) FROM users GROUP BY 1,2 ORDER BY 3 DESC;
-- Оба столбца больше не читаются ни бэкендом, ни фронтом.

ALTER TABLE "users" DROP COLUMN IF EXISTS "status";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

-- Откат (если что-то пошло не так) — колонки возвращаются пустыми, роли не теряются:
--   ALTER TABLE "users" ADD COLUMN "status" TEXT DEFAULT 'active';
--   ALTER TABLE "users" ADD COLUMN "role" BOOLEAN;
--   UPDATE "users" SET "status" = CASE
--     WHEN "roles" @> ARRAY['global:admin'] THEN 'admin'
--     WHEN "roles" @> ARRAY['global:moderator'] THEN 'moderator'
--     WHEN "roles" @> ARRAY['global:activist'] THEN 'activist'
--     WHEN "roles" @> ARRAY['global:blocked'] THEN 'blocked'
--     ELSE 'active' END;
