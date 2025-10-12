-- Migration: Add new features (Bookings, Comments, Ad Expiration, Extended Lifecycle)

-- 1. Add new columns to ads table
ALTER TABLE ads ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS extended_count INTEGER DEFAULT 0;

-- Create index for expires_at (for cron job)
CREATE INDEX IF NOT EXISTS idx_ads_expires_at ON ads(expires_at) WHERE expires_at IS NOT NULL;

-- 2. Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  priority INTEGER DEFAULT 0,
  message TEXT,
  seller_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_id, user_id)
);

-- Create indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_ad_id ON bookings(ad_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_priority ON bookings(priority);

-- 3. Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_seller BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_ad_id ON comments(ad_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- 4. Add moderator role option (update check constraint if exists)
DO $$
BEGIN
  -- Add 'moderator' to status enum if not exists
  -- Note: This is a simple approach, for production use ALTER TYPE
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
  ALTER TABLE users ADD CONSTRAINT users_status_check 
    CHECK (status IN ('user', 'admin', 'moderator'));
END $$;

-- 5. Create updated_at trigger for bookings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Seed default expires_at for existing ads (30 days from now)
UPDATE ads 
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL AND status = 'active';

COMMENT ON TABLE bookings IS 'Booking/reservation system for ads with queue';
COMMENT ON TABLE comments IS 'Comments/chat system for ads with threaded replies';
COMMENT ON COLUMN ads.expires_at IS 'Auto-archive date for ad lifecycle management';
COMMENT ON COLUMN ads.extended_count IS 'Number of times ad was extended by owner';

