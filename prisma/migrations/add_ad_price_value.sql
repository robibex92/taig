-- ads.price_value: число рядом со строкой цены
--
-- `price` остаётся как её ввёл автор: её показывают карточка и выгрузка в чаты.
-- Но сортировать и фильтровать строку в SQL нельзя, и до этой колонки список с
-- ценовым фильтром читался целиком и резался в JS.
--
-- Правило переноса то же, что в core/utils/price.js: запятая — десятичный
-- разделитель (меняется первая), берётся первый числовой токен («1 200 ₽» → 1200),
-- всё, что числом не является, становится NULL («Договорная» → NULL).
-- Разделитель тысяч в этой колонке не ставится, поэтому «1.500» читается как 1.5.
--
-- Запуск: cat prisma/migrations/add_ad_price_value.sql | sudo -u postgres psql -d mydatabase

ALTER TABLE "ads"
  ADD COLUMN IF NOT EXISTS "price_value" NUMERIC(12,2);

UPDATE "ads"
SET "price_value" = CASE
  WHEN "price" IS NULL OR btrim("price") = '' THEN NULL
  ELSE substring(
    regexp_replace(regexp_replace("price", ',', '.'), '[^0-9.]', '', 'g')
    from '^[0-9]+(\.[0-9]+)?'
  )::numeric
END;

-- Порядок по цене и диапазон — оба ходят по этой колонке; NULL в конце списка,
-- но в индекс они попадают, и пустые значения их не отравляют.
CREATE INDEX IF NOT EXISTS "idx_ads_price_value" ON "ads" ("price_value");
