-- Комментариям дома и подъезда нужен собственный адрес здания, и по одному тексту на адрес.
--
-- Причина: `house_comments.house_id` и `entrance_comments.house_id` указывают на
-- строку таблицы `houses`, а это таблица КВАРТИР: у номера дома столько строк,
-- сколько в нём квартир. Комментарий, записанный для дома `37/1` через id
-- конкретной квартиры, уезжал вместе с квартирой — так прод отдавал текст про
-- 37/1, когда открывали первый подъезд дома 39 (проверено 15.10.2026).
--
-- Отсюда же дубли: сохранение не находило существующий текст (адрес был потерян)
-- и писало новый ряд вместо замены одного.
--
-- После этого файла: адрес — `house_number` ('39', '39/1'), на один адрес лежит
-- ровно один текст (уникальный индекс), `house_id` остаётся заполняться самой
-- ранней квартирой дома ради совместимости и отката.
--
-- Ничего безвозвратно не удаляется: схлопнутые строки сначала складываются в
-- `house_comments_dropped` / `entrance_comments_dropped`. Вернуть одну обратно:
--   INSERT INTO house_comments SELECT * FROM house_comments_dropped WHERE id = 12;
--
--   cat prisma/migrations/add_comment_house_number.sql | sudo -u postgres psql -d mydatabase
--
-- Порядок выката: ЭТОТ ФАЙЛ → `npx prisma generate` → код → `pm2 restart taig`.
-- Рестарт без файла оставит чтения без `house_number`, и подписи «i» станут пустыми.

BEGIN;

ALTER TABLE house_comments    ADD COLUMN IF NOT EXISTS house_number VARCHAR(20);
ALTER TABLE entrance_comments ADD COLUMN IF NOT EXISTS house_number VARCHAR(20);

-- 1. Перенос: номер дома той квартиры, на которую сейчас указал house_id.
UPDATE house_comments c
   SET house_number = h.house
  FROM houses h
 WHERE h.id = c.house_id
   AND c.house_number IS NULL;

UPDATE entrance_comments e
   SET house_number = h.house
  FROM houses h
 WHERE h.id = e.house_id
   AND e.house_number IS NULL;

-- 2. Дубликаты: на адрес остаётся самый свежий текст — ровно тот, что интерфейс
--    показывает и сейчас (`ORDER BY created_at DESC`). Остальные уходят в backup.
CREATE TABLE IF NOT EXISTS house_comments_dropped (LIKE house_comments INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS entrance_comments_dropped (LIKE entrance_comments INCLUDING DEFAULTS);

INSERT INTO house_comments_dropped
SELECT c.*
  FROM house_comments c
 WHERE c.house_number IS NOT NULL
   AND c.id NOT IN (
         SELECT id FROM (
           SELECT id,
                  row_number() OVER (
                    PARTITION BY house_number
                    ORDER BY created_at DESC, id DESC
                  ) AS rn
             FROM house_comments
            WHERE house_number IS NOT NULL
         ) ranked
        WHERE ranked.rn = 1
   );

DELETE FROM house_comments c
 WHERE c.id IN (SELECT id FROM house_comments_dropped);

INSERT INTO entrance_comments_dropped
SELECT e.*
  FROM entrance_comments e
 WHERE e.house_number IS NOT NULL
   AND e.id NOT IN (
         SELECT id FROM (
           SELECT id,
                  row_number() OVER (
                    PARTITION BY house_number, entrance
                    ORDER BY created_at DESC, id DESC
                  ) AS rn
             FROM entrance_comments
            WHERE house_number IS NOT NULL
         ) ranked
        WHERE ranked.rn = 1
   );

DELETE FROM entrance_comments e
 WHERE e.id IN (SELECT id FROM entrance_comments_dropped);

-- 3. Второй текст на тот же адрес станет невозможен на уровне базы.
CREATE UNIQUE INDEX IF NOT EXISTS house_comments_house_number_key
    ON house_comments (house_number)
 WHERE house_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entrance_comments_house_number_entrance_key
    ON entrance_comments (house_number, entrance)
 WHERE house_number IS NOT NULL;

COMMIT;

-- 4. Что осталось на каждый адрес — и что править руками, если текст приехал не свой.
SELECT house_number AS domain, 'весь дом' AS address, left(comment, 70) AS shown_comment
  FROM house_comments
 ORDER BY house_number;

SELECT house_number AS domain,
       'подъезд ' || entrance AS address,
       left(comment, 70)      AS shown_comment
  FROM entrance_comments
 ORDER BY house_number, entrance;

-- Что отложено в backup (история, не участвующая в показах).
SELECT 'house_comments' AS source, count(*) AS dropped
  FROM house_comments_dropped
UNION ALL
SELECT 'entrance_comments', count(*) FROM entrance_comments_dropped;
