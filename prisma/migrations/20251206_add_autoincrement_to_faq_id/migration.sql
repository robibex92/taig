-- AlterTable
-- Сначала удаляем старый первичный ключ, если он существует
ALTER TABLE "faq" DROP CONSTRAINT IF EXISTS "faq_pkey";

-- Изменяем тип колонки id на BIGSERIAL, что автоматически создаст sequence и установит его как default
-- Этот подход более надежен для PostgreSQL
ALTER TABLE "faq" ALTER COLUMN "id" DROP DEFAULT;
CREATE SEQUENCE IF NOT EXISTS faq_id_seq;
ALTER TABLE "faq" ALTER COLUMN "id" SET DEFAULT nextval('faq_id_seq');
ALTER SEQUENCE faq_id_seq OWNED BY "faq"."id";
SELECT setval('faq_id_seq', (SELECT COALESCE(MAX(id), 1) FROM "faq"), false);

-- Восстанавливаем первичный ключ
ALTER TABLE "faq" ADD CONSTRAINT "faq_pkey" PRIMARY KEY ("id");