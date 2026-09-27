-- Migration: раскладка сетки «Сосед, привет» управляется с фронта
--
-- Витрина строится рядами по этажам; раньше квартира могла только занять одну
-- ячейку, а сдвиг ряда задавался одним значением на весь этаж (`floor_rules.position`).
-- Добавили два поля на квартиру:
--   cell_span  — сколько ячеек занимает (null = 1);
--   cell_index — номер колонки от левого края (null = расставить автоматически
--                по номеру квартиры, с учётом сдвига этажа).
--
-- ВАЖНО: `houses.position` не трогать и не путать с `cell_index` — это индекс
-- совладельца (1, 2, …), по нему витрина берёт основную запись (`position = 1`).
--
-- Оба поля nullable, существующие записи менять не нужно — поведение остаётся прежним.
--
-- Применяется от привилегированной роли:
--   cat prisma/migrations/add_house_grid.sql | sudo -u postgres psql -d mydatabase
--
-- После этого — `npx prisma generate`. Читать работает и до применения DDL, но
-- сохранение раскладки упадёт с «column houses.cell_index does not exist».

ALTER TABLE houses
    ADD COLUMN IF NOT EXISTS cell_span integer,
    ADD COLUMN IF NOT EXISTS cell_index integer;

COMMENT ON COLUMN houses.cell_span IS
    'Сколько ячеек сетки квартир занимает эта квартира; NULL или 1 — обычная ширина';

COMMENT ON COLUMN houses.cell_index IS
    'Номер колонки в ряду этажа, 0 — первая; NULL — расстановка по номеру квартиры';
