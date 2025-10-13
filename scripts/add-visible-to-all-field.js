import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config(); // Load environment variables

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding visible_to_all field to telegram_chats table...");

    // Add column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE telegram_chats 
      ADD COLUMN IF NOT EXISTS visible_to_all BOOLEAN NOT NULL DEFAULT true;
    `);
    console.log("✅ Column visible_to_all added");

    // Add index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_telegram_chats_visible_to_all ON telegram_chats(visible_to_all);
    `);
    console.log("✅ Index created");

    // Update existing chats
    await prisma.$executeRawUnsafe(`
      UPDATE telegram_chats SET visible_to_all = true WHERE visible_to_all IS NULL;
    `);
    console.log("✅ Existing chats updated");

    // Verify
    const count = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM telegram_chats WHERE visible_to_all = true;`
    );
    console.log(`✅ Total chats visible to all: ${count[0].count}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
