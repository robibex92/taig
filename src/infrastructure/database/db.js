import { prisma } from "./prisma.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Test database connection using Prisma
 */
export const testConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Database connection successful (Prisma)");
    return true;
  } catch (error) {
    logger.error("Database connection failed (Prisma)", { 
      error: error.message 
    });
    return false;
  }
};

/**
 * Close Prisma connection
 */
export const closeConnection = async () => {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  } catch (error) {
    logger.error("Error disconnecting Prisma", { error: error.message });
  }
};

// Export prisma instance for direct use
export { prisma };
