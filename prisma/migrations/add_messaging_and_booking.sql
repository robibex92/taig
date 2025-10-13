-- Add messaging and booking system
-- Migration generated on 2025-10-13

-- ============================================
-- MESSAGING SYSTEM
-- ============================================

-- CreateTable: messages
CREATE TABLE IF NOT EXISTS "messages" (
    "id" BIGSERIAL NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "ad_id" BIGINT,
    "parent_id" BIGINT,
    "thread_id" BIGINT,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: conversations
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" BIGSERIAL NOT NULL,
    "user1_id" BIGINT NOT NULL,
    "user2_id" BIGINT NOT NULL,
    "ad_id" BIGINT,
    "last_message_id" BIGINT,
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- BOOKING SYSTEM
-- ============================================

-- CreateTable: bookings
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" BIGSERIAL NOT NULL,
    "ad_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "booking_order" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- INDEXES - MESSAGING
-- ============================================

-- Messages indexes
CREATE INDEX IF NOT EXISTS "messages_sender_id_receiver_id_idx" ON "messages"("sender_id", "receiver_id");
CREATE INDEX IF NOT EXISTS "messages_ad_id_idx" ON "messages"("ad_id");
CREATE INDEX IF NOT EXISTS "messages_thread_id_idx" ON "messages"("thread_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at" DESC);

-- Conversations indexes
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_user1_id_user2_id_ad_id_key" ON "conversations"("user1_id", "user2_id", "ad_id");
CREATE INDEX IF NOT EXISTS "conversations_user1_id_idx" ON "conversations"("user1_id");
CREATE INDEX IF NOT EXISTS "conversations_user2_id_idx" ON "conversations"("user2_id");
CREATE INDEX IF NOT EXISTS "conversations_ad_id_idx" ON "conversations"("ad_id");
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations"("last_message_at" DESC);

-- ============================================
-- INDEXES - BOOKING
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_ad_id_user_id_status_key" ON "bookings"("ad_id", "user_id", "status");
CREATE INDEX IF NOT EXISTS "bookings_ad_id_status_idx" ON "bookings"("ad_id", "status");
CREATE INDEX IF NOT EXISTS "bookings_user_id_status_idx" ON "bookings"("user_id", "status");
CREATE INDEX IF NOT EXISTS "bookings_created_at_idx" ON "bookings"("created_at" DESC);

-- ============================================
-- FOREIGN KEYS - MESSAGING
-- ============================================

-- Messages foreign keys
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" 
    FOREIGN KEY ("sender_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" 
    FOREIGN KEY ("receiver_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_ad_id_fkey" 
    FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_fkey" 
    FOREIGN KEY ("parent_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conversations foreign keys
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_fkey" 
    FOREIGN KEY ("user1_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_fkey" 
    FOREIGN KEY ("user2_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ad_id_fkey" 
    FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- FOREIGN KEYS - BOOKING
-- ============================================

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ad_id_fkey" 
    FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

