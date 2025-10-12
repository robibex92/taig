-- ============================================
-- Migration: Add refresh_tokens table
-- Description: Session management for improved auth security
-- Date: 2025-01-12
-- ============================================

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  jti VARCHAR(255) NOT NULL UNIQUE,
  device_fingerprint VARCHAR(255),
  ip_address VARCHAR(100),
  user_agent TEXT,
  device_info JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  
  -- Foreign key constraint
  CONSTRAINT fk_refresh_tokens_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(user_id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Comment on table
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens and user sessions for enhanced security';

-- Comments on columns
COMMENT ON COLUMN refresh_tokens.id IS 'Primary key';
COMMENT ON COLUMN refresh_tokens.user_id IS 'Reference to users table';
COMMENT ON COLUMN refresh_tokens.token IS 'The refresh token itself (hashed in production)';
COMMENT ON COLUMN refresh_tokens.jti IS 'JWT ID - unique identifier from token payload';
COMMENT ON COLUMN refresh_tokens.device_fingerprint IS 'SHA256 hash of device info (UA + IP + Lang)';
COMMENT ON COLUMN refresh_tokens.ip_address IS 'IP address of the device';
COMMENT ON COLUMN refresh_tokens.user_agent IS 'User-Agent string from request';
COMMENT ON COLUMN refresh_tokens.device_info IS 'Full device information as JSON';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'When the refresh token expires';
COMMENT ON COLUMN refresh_tokens.created_at IS 'When the session was created';
COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Last time the token was used for refresh';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Whether the token has been revoked';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'When the token was revoked';

-- ============================================
-- Optional: Cleanup function for expired tokens
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired tokens
  DELETE FROM refresh_tokens
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Cleanup function to remove expired refresh tokens';

-- ============================================
-- Optional: Scheduled cleanup (requires pg_cron extension)
-- ============================================

-- Uncomment if you have pg_cron installed:
-- SELECT cron.schedule('cleanup-refresh-tokens', '0 2 * * *', 'SELECT cleanup_expired_refresh_tokens();');

-- ============================================
-- Verification queries
-- ============================================

-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'refresh_tokens'
) AS table_exists;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'refresh_tokens';

-- Check foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='refresh_tokens';

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'refresh_tokens table created with all indexes and constraints.';
END $$;

