-- Migration: Add MAX Platform Integration
-- Adds MAX authentication, account linking, and MAX messaging support
-- MAX Platform: https://dev.max.ru/docs

-- 1. Add MAX fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_last_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_platform VARCHAR(50);

-- Add account linking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_platform VARCHAR(20) DEFAULT 'telegram';
ALTER TABLE users ADD COLUMN IF NOT EXISTS platforms_linked BOOLEAN DEFAULT FALSE;

-- Rename telegram-specific fields for clarity (if needed)
-- ALTER TABLE users RENAME COLUMN username TO telegram_username;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255); -- General username

-- Create indexes for MAX fields
CREATE INDEX IF NOT EXISTS idx_users_max_id ON users(max_id) WHERE max_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_primary_platform ON users(primary_platform);

-- 2. Add platform field to refresh_tokens
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS platform VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_platform ON refresh_tokens(platform);

-- 3. Create max_messages table (similar to telegram_messages)
CREATE TABLE IF NOT EXISTS max_messages (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_max_messages_entity ON max_messages(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_max_messages_chat_id ON max_messages(chat_id);

-- 4. Add MAX platform support to ads table
ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_max BOOLEAN DEFAULT FALSE;

-- 5. Update posts source to support MAX
-- Already has 'source' field, just document that 'max' is now a valid value
COMMENT ON COLUMN posts.source IS 'Source platform: web, telegram, or max';

-- 6. Add check constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_primary_platform_check;
ALTER TABLE users ADD CONSTRAINT users_primary_platform_check 
  CHECK (primary_platform IN ('telegram', 'max'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_platform_validation;
ALTER TABLE users ADD CONSTRAINT users_platform_validation 
  CHECK (
    (id_telegram IS NOT NULL OR max_id IS NOT NULL) AND
    (platforms_linked = FALSE OR (id_telegram IS NOT NULL AND max_id IS NOT NULL))
  );

ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_platform_check;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_platform_check 
  CHECK (platform IS NULL OR platform IN ('telegram', 'max', 'web'));

-- 7. Update existing data
-- Set platform for existing refresh tokens
UPDATE refresh_tokens SET platform = 'telegram' WHERE platform IS NULL;

-- Set primary_platform for existing users based on what they have
UPDATE users 
SET primary_platform = 'telegram' 
WHERE id_telegram IS NOT NULL AND max_id IS NULL;

UPDATE users 
SET platforms_linked = TRUE 
WHERE id_telegram IS NOT NULL AND max_id IS NOT NULL;

-- 8. Add comments for documentation
COMMENT ON TABLE max_messages IS 'Stores MAX messages sent by the bot (similar to telegram_messages)';
COMMENT ON COLUMN users.max_id IS 'MAX user ID from MAX Platform (https://dev.max.ru/docs)';
COMMENT ON COLUMN users.max_platform IS 'MAX platform type: mobile, desktop, etc.';
COMMENT ON COLUMN users.primary_platform IS 'Preferred platform for notifications: telegram or max';
COMMENT ON COLUMN users.platforms_linked IS 'TRUE if both Telegram and MAX accounts are linked';
COMMENT ON COLUMN refresh_tokens.platform IS 'Platform used for this session: telegram, max, or web';
COMMENT ON COLUMN ads.is_max IS 'Whether to post this ad to MAX chats';

-- 9. Create helper function to get user's notification platform
CREATE OR REPLACE FUNCTION get_user_notification_platform(p_user_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  v_platform VARCHAR(20);
  v_primary_platform VARCHAR(20);
  v_has_telegram BOOLEAN;
  v_has_max BOOLEAN;
BEGIN
  SELECT 
    primary_platform,
    (id_telegram IS NOT NULL),
    (max_id IS NOT NULL)
  INTO v_primary_platform, v_has_telegram, v_has_max
  FROM users
  WHERE id = p_user_id;
  
  -- Return primary platform if available, otherwise fallback
  IF v_primary_platform = 'telegram' AND v_has_telegram THEN
    RETURN 'telegram';
  ELSIF v_primary_platform = 'max' AND v_has_max THEN
    RETURN 'max';
  ELSIF v_has_telegram THEN
    RETURN 'telegram';
  ELSIF v_has_max THEN
    RETURN 'max';
  ELSE
    RETURN 'none';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_notification_platform IS 'Returns the platform to use for sending notifications to a user';

-- 10. Create view for user platforms
CREATE OR REPLACE VIEW user_platforms AS
SELECT 
  id,
  user_id,
  CASE 
    WHEN id_telegram IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END AS has_telegram,
  CASE 
    WHEN max_id IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END AS has_max,
  platforms_linked,
  primary_platform,
  COALESCE(
    CASE 
      WHEN primary_platform = 'telegram' AND id_telegram IS NOT NULL THEN id_telegram
      WHEN primary_platform = 'max' AND max_id IS NOT NULL THEN max_id
      WHEN id_telegram IS NOT NULL THEN id_telegram
      WHEN max_id IS NOT NULL THEN max_id
    END
  ) AS active_platform_id
FROM users;

COMMENT ON VIEW user_platforms IS 'Helper view for querying user platform information';

