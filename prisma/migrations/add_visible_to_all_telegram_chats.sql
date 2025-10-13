-- Add visible_to_all column to telegram_chats table
-- This controls whether the chat is visible to all users or only to admins

ALTER TABLE telegram_chats 
ADD COLUMN IF NOT EXISTS visible_to_all BOOLEAN NOT NULL DEFAULT true;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_telegram_chats_visible_to_all ON telegram_chats(visible_to_all);

-- Update existing chats to be visible to all by default
UPDATE telegram_chats SET visible_to_all = true WHERE visible_to_all IS NULL;

