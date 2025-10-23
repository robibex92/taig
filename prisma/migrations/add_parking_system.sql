-- CreateTable
CREATE TABLE "parking_spots" (
    "id" BIGSERIAL NOT NULL,
    "spot_number" INTEGER NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "section" VARCHAR(50),
    "owner_id" BIGINT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'undefined',
    "price" VARCHAR(50),
    "description" TEXT,
    "contact_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parking_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_spot_history" (
    "id" BIGSERIAL NOT NULL,
    "parking_spot_id" BIGINT NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by_id" BIGINT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parking_spot_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_messages" (
    "id" BIGSERIAL NOT NULL,
    "parking_spot_id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "parking_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parking_spots_spot_number_key" ON "parking_spots"("spot_number");

-- CreateIndex
CREATE INDEX "parking_spots_spot_number_idx" ON "parking_spots"("spot_number");

-- CreateIndex
CREATE INDEX "parking_spots_owner_id_idx" ON "parking_spots"("owner_id");

-- CreateIndex
CREATE INDEX "parking_spots_status_idx" ON "parking_spots"("status");

-- CreateIndex
CREATE INDEX "parking_spots_floor_idx" ON "parking_spots"("floor");

-- CreateIndex
CREATE INDEX "parking_spots_is_active_idx" ON "parking_spots"("is_active");

-- CreateIndex
CREATE INDEX "parking_spot_history_parking_spot_id_idx" ON "parking_spot_history"("parking_spot_id");

-- CreateIndex
CREATE INDEX "parking_spot_history_changed_at_idx" ON "parking_spot_history"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "parking_messages_parking_spot_id_idx" ON "parking_messages"("parking_spot_id");

-- CreateIndex
CREATE INDEX "parking_messages_sender_id_receiver_id_idx" ON "parking_messages"("sender_id", "receiver_id");

-- CreateIndex
CREATE INDEX "parking_messages_created_at_idx" ON "parking_messages"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "parking_spots" ADD CONSTRAINT "parking_spots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spot_history" ADD CONSTRAINT "parking_spot_history_parking_spot_id_fkey" FOREIGN KEY ("parking_spot_id") REFERENCES "parking_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spot_history" ADD CONSTRAINT "parking_spot_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_messages" ADD CONSTRAINT "parking_messages_parking_spot_id_fkey" FOREIGN KEY ("parking_spot_id") REFERENCES "parking_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_messages" ADD CONSTRAINT "parking_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_messages" ADD CONSTRAINT "parking_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert initial parking spots (1-99)
INSERT INTO "parking_spots" ("spot_number", "floor", "status") 
SELECT 
    generate_series(1, 99) as spot_number,
    1 as floor,
    'undefined' as status;
