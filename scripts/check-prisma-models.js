import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkModels() {
  try {
    console.log("Checking Prisma models...");

    // Проверяем основные модели
    console.log("Available models:");
    console.log("- prisma.user:", !!prisma.user);
    console.log("- prisma.house:", !!prisma.house);
    console.log("- prisma.houseComment:", !!prisma.houseComment);
    console.log("- prisma.entranceComment:", !!prisma.entranceComment);

    // Проверяем, можем ли мы выполнить простой запрос
    console.log("\nTesting basic queries...");

    try {
      const userCount = await prisma.user.count();
      console.log("✓ User count:", userCount);
    } catch (error) {
      console.log("✗ User query failed:", error.message);
    }

    try {
      const houseCount = await prisma.house.count();
      console.log("✓ House count:", houseCount);
    } catch (error) {
      console.log("✗ House query failed:", error.message);
    }

    try {
      if (prisma.houseComment) {
        const commentCount = await prisma.houseComment.count();
        console.log("✓ House comment count:", commentCount);
      } else {
        console.log("✗ houseComment model not available");
      }
    } catch (error) {
      console.log("✗ House comment query failed:", error.message);
    }

    try {
      if (prisma.entranceComment) {
        const entranceCommentCount = await prisma.entranceComment.count();
        console.log("✓ Entrance comment count:", entranceCommentCount);
      } else {
        console.log("✗ entranceComment model not available");
      }
    } catch (error) {
      console.log("✗ Entrance comment query failed:", error.message);
    }
  } catch (error) {
    console.error("Error checking models:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkModels();
