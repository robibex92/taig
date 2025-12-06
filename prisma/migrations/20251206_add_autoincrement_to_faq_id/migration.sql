-- AlterTable
-- Удаляем текущий первичный ключ и создаем новый с автоинкрементом
ALTER TABLE "faq" ALTER COLUMN "id" TYPE bigint;
-- Удаляем существующий sequence, если он есть
DROP SEQUENCE IF EXISTS faq_id_seq CASCADE;
-- Создаем sequence для автоинкремента
CREATE SEQUENCE faq_id_seq AS bigint START WITH 1;
-- Устанавливаем значение id как серийное с использованием sequence
ALTER TABLE "faq" ALTER COLUMN "id" SET DEFAULT nextval('faq_id_seq');
-- Обновляем sequence до максимального значения id в таблице
SELECT setval('faq_id_seq', (SELECT COALESCE(MAX(id), 0) FROM "faq"));
-- Восстанавливаем первичный ключ
ALTER TABLE "faq" ADD CONSTRAINT "faq_pkey" PRIMARY KEY ("id");