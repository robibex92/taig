import { PrismaClient } from "@prisma/client";
import { logger } from "../../core/utils/logger.js";

/**
 * Prisma Client Singleton
 * Prevents multiple instances in development hot reload
 */
const globalForPrisma = global;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Connection event handlers
prisma.$on("query", (e) => {
  if (process.env.NODE_ENV === "development") {
    logger.debug("Prisma Query", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  }
});

/**
 * Test Prisma connection
 */
export const testPrismaConnection = async () => {
  try {
    await prisma.$connect();
    logger.info("Prisma connected successfully");
    return true;
  } catch (error) {
    logger.error("Prisma connection failed", { error: error.message });
    return false;
  }
};

/**
 * Close Prisma connection
 */
export const closePrismaConnection = async () => {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  } catch (error) {
    logger.error("Error disconnecting Prisma", { error: error.message });
  }
};

/**
 * Handle graceful shutdown
 */
process.on("beforeExit", async () => {
  await closePrismaConnection();
});

export default prisma;
