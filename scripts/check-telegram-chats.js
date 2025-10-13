import { prisma } from "../src/infrastructure/database/db.js";

async function checkTelegramChats() {
  try {
    const chats = await prisma.$queryRawUnsafe(`SELECT * FROM telegram_chats;`);
    console.log(`✅ Found ${chats.length} chats in telegram_chats table:`);
    console.table(chats);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTelegramChats();
