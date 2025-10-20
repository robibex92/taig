import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTables() {
  try {
    console.log("Creating comment tables...");

    // Проверяем, существуют ли таблицы
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('house_comments', 'entrance_comments')
    `;

    console.log("Existing tables:", tables);

    if (tables.length === 0) {
      console.log("Tables do not exist. Creating them...");

      // Создаем таблицы
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "house_comments" (
            "id" BIGSERIAL NOT NULL,
            "house_id" BIGINT NOT NULL,
            "author_id" BIGINT NOT NULL,
            "comment" TEXT NOT NULL,
            "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "house_comments_pkey" PRIMARY KEY ("id")
        );
      `;

      await prisma.$executeRaw`
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
      `;

      // Создаем индексы
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "house_comments_house_id_idx" ON "house_comments"("house_id");`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "house_comments_author_id_idx" ON "house_comments"("author_id");`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "house_comments_created_at_idx" ON "house_comments"("created_at");`;

      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "entrance_comments_author_id_idx" ON "entrance_comments"("author_id");`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "entrance_comments_created_at_idx" ON "entrance_comments"("created_at");`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "entrance_comments_house_id_entrance_key" ON "entrance_comments"("house_id", "entrance");`;

      console.log("Tables created successfully!");
    } else {
      console.log("Tables already exist.");
    }
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTables();
