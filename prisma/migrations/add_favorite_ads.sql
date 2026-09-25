-- Migration: ИЗБРАННОЕ — сохранённые объявления жителя
-- Схема: prisma/schema.prisma -> FavoriteAd (@@map "favorite_ads")
-- Код:   src/application/use-cases/favorites/FavoritesUseCases.js
--        src/presentation/controllers/FavoritesController.js
--        src/presentation/routes/favorites.routes.js
--
-- Применяется так же, как остальные файлы каталога:
--   npx prisma db execute --file prisma/migrations/add_favorite_ads.sql --schema prisma/schema.prisma
-- либо владельцем таблицы (на проде):
--   cat prisma/migrations/add_favorite_ads.sql | sudo -u postgres psql -d mydatabase

CREATE TABLE IF NOT EXISTS "favorite_ads" (
  "id"         BIGSERIAL PRIMARY KEY,
  "user_id"    BIGINT NOT NULL,
  "ad_id"      BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- житатель не может сохранить одно объявление дважды
  CONSTRAINT "favorite_ads_user_ad_key" UNIQUE ("user_id", "ad_id"),
  CONSTRAINT "favorite_ads_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE,
  CONSTRAINT "favorite_ads_ad_fkey"
    FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE
);

-- Лента избранного в профиле: новые сверху
CREATE INDEX IF NOT EXISTS "idx_favorite_ads_user_created"
  ON "favorite_ads" ("user_id", "created_at" DESC);

-- Проверка «сколько жителей сохранили это объявление»
CREATE INDEX IF NOT EXISTS "idx_favorite_ads_ad"
  ON "favorite_ads" ("ad_id");
