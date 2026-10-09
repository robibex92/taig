-- ads.offer_type и ads.rental_days: соседский прокат
--
-- Прокат — не новая сущность. Автор, описание, картинки, очередь брони — всё
-- то же, поэтому у `ads` два новых поля вместо отдельной таблицы «предложений».
--
-- offer_type: 'sale' (как было до этой колонки — легаси-строки попадают под
--   дефолт) или 'rent'.
-- rental_days: заполнен только при 'rent'; карточка проката без срока обещала
--   бы непонятное.
--
-- Прогонять от привилегированной роли: CHECK на чужой таблице приложение не
-- добавит.
-- Запуск: cat prisma/migrations/add_ad_offer_type.sql | sudo -u postgres psql -d mydatabase

ALTER TABLE "ads"
  ADD COLUMN IF NOT EXISTS "offer_type" VARCHAR(20) NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS "rental_days" INTEGER;

ALTER TABLE "ads" DROP CONSTRAINT IF EXISTS "ads_offer_type_check";

ALTER TABLE "ads"
  ADD CONSTRAINT "ads_offer_type_check" CHECK ("offer_type" IN ('sale', 'rent'));

ALTER TABLE "ads" DROP CONSTRAINT IF EXISTS "ads_rental_days_check";

ALTER TABLE "ads"
  ADD CONSTRAINT "ads_rental_days_check" CHECK ("rental_days" IS NULL OR ("rental_days" BETWEEN 1 AND 365));

-- «Срок бывает только у проката» в базу CHECK не вынесен: правка объявления
-- одним запросом меняет и тип, и срок, и объявление, переведённое обратно в
-- продажу, должно успеть обнулить срок. Это правило держит слой
-- валидации и репозиторий (see AdRepository._offerFields).
