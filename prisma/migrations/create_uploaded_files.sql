-- uploaded_files: кто принёс файл и когда
--
-- До этой таблицы `/api/upload` просто клал файл в каталог: ни владельца, ни
-- даты, поэтому нельзя было ни запретить соседу стирать чужую фотографию, ни
-- убрать то, что загрузили и ни к чему не присвоили.
--
-- Ссылка на пользователя — не внешний ключ: файл переживает снятое объявление и
-- не должен исчезать вместе с аккаунтом, а уборкой занимается отдельная задача.
--
-- Запуск: cat prisma/migrations/create_uploaded_files.sql | sudo -u postgres psql -d mydatabase

CREATE TABLE IF NOT EXISTS "uploaded_files" (
  "id"          BIGSERIAL PRIMARY KEY,
  "filename"    TEXT      NOT NULL UNIQUE,
  "uploaded_by" BIGINT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_uploaded_files_created_at"
  ON "uploaded_files" ("created_at");
