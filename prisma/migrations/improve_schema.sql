-- ============================================
-- УЛУЧШЕНИЕ СТРУКТУРЫ БД
-- ============================================
-- ВАЖНО: Выполнять по частям, проверяя каждый шаг!
-- Перед выполнением сделайте backup БД!
-- ============================================

BEGIN;

-- ============================================
-- 1. УЛУЧШЕНИЕ ТИПОВ ДАННЫХ
-- ============================================

-- Users: улучшение типов данных (только добавление ограничений)
ALTER TABLE users 
  ALTER COLUMN joined_at SET DEFAULT NOW(),
  ALTER COLUMN role SET DEFAULT false,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN username TYPE VARCHAR(100),
  ALTER COLUMN first_name TYPE VARCHAR(100),
  ALTER COLUMN last_name TYPE VARCHAR(100),
  ALTER COLUMN telegram_first_name TYPE VARCHAR(100),
  ALTER COLUMN telegram_last_name TYPE VARCHAR(100),
  ALTER COLUMN status TYPE VARCHAR(50),
  ALTER COLUMN is_manually_updated TYPE VARCHAR(10);

-- Ads: улучшение типов и NOT NULL constraints
ALTER TABLE ads
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN view_count SET DEFAULT 0,
  ALTER COLUMN title TYPE VARCHAR(255),
  ALTER COLUMN status TYPE VARCHAR(50),
  ALTER COLUMN price TYPE VARCHAR(50);

-- Ad Images: улучшение типов
ALTER TABLE ad_images
  ALTER COLUMN image_url SET NOT NULL,
  ALTER COLUMN is_main SET DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(6);

-- Posts: улучшение типов и NOT NULL constraints
ALTER TABLE posts
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN title TYPE VARCHAR(255),
  ALTER COLUMN status TYPE VARCHAR(50),
  ALTER COLUMN source TYPE VARCHAR(100),
  ALTER COLUMN marker TYPE VARCHAR(100);

-- Telegram Messages: улучшение типов
ALTER TABLE telegram_messages
  ALTER COLUMN chat_id SET NOT NULL,
  ALTER COLUMN message_id SET NOT NULL,
  ALTER COLUMN is_media SET DEFAULT false,
  ALTER COLUMN chat_id TYPE VARCHAR(100),
  ALTER COLUMN thread_id TYPE VARCHAR(100),
  ALTER COLUMN media_group_id TYPE VARCHAR(100),
  ALTER COLUMN price TYPE VARCHAR(50),
  ALTER COLUMN message_type TYPE VARCHAR(50),
  ALTER COLUMN context_type TYPE VARCHAR(50),
  ALTER COLUMN recipient_id TYPE VARCHAR(100),
  ALTER COLUMN sender_id TYPE VARCHAR(100);

-- Houses: типы данных
ALTER TABLE houses
  ALTER COLUMN status SET DEFAULT true,
  ALTER COLUMN position SET DEFAULT 1,
  ALTER COLUMN house TYPE VARCHAR(50),
  ALTER COLUMN facade_color TYPE VARCHAR(50);

-- Floor Rules: типы данных
ALTER TABLE floor_rules
  ALTER COLUMN house TYPE VARCHAR(50);

-- Cars: типы данных
ALTER TABLE cars
  ALTER COLUMN status SET DEFAULT true,
  ALTER COLUMN car_number TYPE VARCHAR(50),
  ALTER COLUMN car_model TYPE VARCHAR(100),
  ALTER COLUMN car_brand TYPE VARCHAR(100),
  ALTER COLUMN car_color TYPE VARCHAR(50);

-- FAQ: улучшение типов и NOT NULL
ALTER TABLE faq
  ALTER COLUMN question SET NOT NULL,
  ALTER COLUMN answer SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status TYPE VARCHAR(50);

-- Categories: улучшение типов
ALTER TABLE categories
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN name TYPE VARCHAR(100),
  ALTER COLUMN image TYPE VARCHAR(255);

-- Subcategories: улучшение типов
ALTER TABLE subcategories
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN name TYPE VARCHAR(100);

-- ============================================
-- 2. ДОБАВЛЕНИЕ FOREIGN KEYS
-- ============================================

-- Ads -> Users
ALTER TABLE ads
  ADD CONSTRAINT fk_ads_user
  FOREIGN KEY (user_id) 
  REFERENCES users(user_id) 
  ON DELETE CASCADE;

-- Ads -> Categories
ALTER TABLE ads
  ADD CONSTRAINT fk_ads_category
  FOREIGN KEY (category) 
  REFERENCES categories(id) 
  ON DELETE RESTRICT;

-- Ads -> Subcategories
ALTER TABLE ads
  ADD CONSTRAINT fk_ads_subcategory
  FOREIGN KEY (subcategory) 
  REFERENCES subcategories(id) 
  ON DELETE SET NULL;

-- Ad Images -> Ads
ALTER TABLE ad_images
  ADD CONSTRAINT fk_ad_images_ad
  FOREIGN KEY (ad_id) 
  REFERENCES ads(id) 
  ON DELETE CASCADE;

-- Ad Images -> Posts
ALTER TABLE ad_images
  ADD CONSTRAINT fk_ad_images_post
  FOREIGN KEY (post_id) 
  REFERENCES posts(id) 
  ON DELETE CASCADE;

-- Telegram Messages -> Ads
ALTER TABLE telegram_messages
  ADD CONSTRAINT fk_telegram_messages_ad
  FOREIGN KEY (ad_id) 
  REFERENCES ads(id) 
  ON DELETE CASCADE;

-- Telegram Messages -> Posts
ALTER TABLE telegram_messages
  ADD CONSTRAINT fk_telegram_messages_post
  FOREIGN KEY (post_id) 
  REFERENCES posts(id) 
  ON DELETE CASCADE;

-- Houses -> Users
ALTER TABLE houses
  ADD CONSTRAINT fk_houses_user
  FOREIGN KEY (id_telegram) 
  REFERENCES users(user_id) 
  ON DELETE SET NULL;

-- Cars -> Users
ALTER TABLE cars
  ADD CONSTRAINT fk_cars_user
  FOREIGN KEY (user_id) 
  REFERENCES users(user_id) 
  ON DELETE CASCADE;

-- Subcategories -> Categories
ALTER TABLE subcategories
  ADD CONSTRAINT fk_subcategories_category
  FOREIGN KEY (category_id) 
  REFERENCES categories(id) 
  ON DELETE CASCADE;

-- ============================================
-- 3. СОЗДАНИЕ ИНДЕКСОВ
-- ============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Ads
CREATE INDEX IF NOT EXISTS idx_ads_user_id ON ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_category ON ads(category);
CREATE INDEX IF NOT EXISTS idx_ads_subcategory ON ads(subcategory);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON ads(created_at DESC);

-- Ad Images
CREATE INDEX IF NOT EXISTS idx_ad_images_ad_id ON ad_images(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_images_post_id ON ad_images(post_id);
CREATE INDEX IF NOT EXISTS idx_ad_images_is_main ON ad_images(is_main);

-- Posts
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Telegram Messages
CREATE INDEX IF NOT EXISTS idx_telegram_messages_ad_id ON telegram_messages(ad_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_post_id ON telegram_messages(post_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_message ON telegram_messages(chat_id, message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at ON telegram_messages(created_at DESC);

-- Houses
CREATE INDEX IF NOT EXISTS idx_houses_location ON houses(house, entrance, number);
CREATE INDEX IF NOT EXISTS idx_houses_id_telegram ON houses(id_telegram);
CREATE INDEX IF NOT EXISTS idx_houses_status ON houses(status);

-- Floor Rules
CREATE INDEX IF NOT EXISTS idx_floor_rules_location ON floor_rules(house, entrance);

-- Cars
CREATE INDEX IF NOT EXISTS idx_cars_user_id ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_number ON cars(car_number);

-- FAQ
CREATE INDEX IF NOT EXISTS idx_faq_status ON faq(status);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Subcategories
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_name ON subcategories(name);

-- ============================================
-- 4. УНИКАЛЬНЫЕ CONSTRAINTS
-- ============================================

-- Floor Rules: уникальность по house + entrance + floor
CREATE UNIQUE INDEX IF NOT EXISTS unique_floor_rule 
  ON floor_rules(house, entrance, floor)
  WHERE house IS NOT NULL AND entrance IS NOT NULL AND floor IS NOT NULL;

COMMIT;

-- ============================================
-- ПРОВЕРКА ПРИМЕНЕНИЯ
-- ============================================

-- Проверка Foreign Keys:
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Проверка индексов:
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

