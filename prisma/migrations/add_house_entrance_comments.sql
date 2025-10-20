-- Create house_comments table
CREATE TABLE IF NOT EXISTS "house_comments" (
    "id" BIGSERIAL NOT NULL,
    "house_id" BIGINT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_comments_pkey" PRIMARY KEY ("id")
);

-- Create entrance_comments table
CREATE TABLE IF NOT EXISTS "entrance_comments" (
    "id" BIGSERIAL NOT NULL,
    "house_id" BIGINT NOT NULL,
    "entrance" INTEGER NOT NULL,
    "author_id" BIGINT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrance_comments_pkey" PRIMARY KEY ("id")
);

-- Create indexes for house_comments
CREATE INDEX IF NOT EXISTS "house_comments_house_id_idx" ON "house_comments"("house_id");
CREATE INDEX IF NOT EXISTS "house_comments_author_id_idx" ON "house_comments"("author_id");
CREATE INDEX IF NOT EXISTS "house_comments_created_at_idx" ON "house_comments"("created_at");

-- Create indexes for entrance_comments
CREATE INDEX IF NOT EXISTS "entrance_comments_author_id_idx" ON "entrance_comments"("author_id");
CREATE INDEX IF NOT EXISTS "entrance_comments_created_at_idx" ON "entrance_comments"("created_at");

-- Create unique constraint for entrance_comments (one comment per house+entrance)
CREATE UNIQUE INDEX IF NOT EXISTS "entrance_comments_house_id_entrance_key" ON "entrance_comments"("house_id", "entrance");

-- Add foreign key constraints
ALTER TABLE "house_comments" ADD CONSTRAINT "house_comments_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "house_comments" ADD CONSTRAINT "house_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "entrance_comments" ADD CONSTRAINT "entrance_comments_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entrance_comments" ADD CONSTRAINT "entrance_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
