-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_ad_id_status_idx" ON "bookings"("ad_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_created_at_idx" ON "bookings"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_ad_id_user_id_status_key" ON "bookings"("ad_id", "user_id", "status");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

