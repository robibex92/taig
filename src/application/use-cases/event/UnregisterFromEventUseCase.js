import { prisma } from "../../../infrastructure/database/prisma.js";
import { NotFoundError } from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Unregister From Event Use Case
 * Cancels a user's registration for an event
 */
export class UnregisterFromEventUseCase {
  async execute(eventId, userId) {
    try {
      // Find registration
      const registration = await prisma.eventRegistration.findUnique({
        where: {
          event_id_user_id: {
            event_id: BigInt(eventId),
            user_id: BigInt(userId),
          },
        },
      });

      if (!registration) {
        throw new NotFoundError("Registration not found");
      }

      // Update status to cancelled
      await prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { status: "cancelled" },
      });

      logger.info("User unregistered from event", {
        eventId,
        userId,
      });

      return { success: true };
    } catch (error) {
      logger.error("Error in UnregisterFromEventUseCase", {
        error: error.message,
      });
      throw error;
    }
  }
}
