import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  NotFoundError,
  ForbiddenError,
} from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Delete Event Use Case
 * Deletes an event (only by creator or admin)
 */
export class DeleteEventUseCase {
  async execute(eventId, userId, userStatus) {
    try {
      // Find event
      const event = await prisma.event.findUnique({
        where: { id: BigInt(eventId) },
        include: {
          _count: {
            select: { registrations: true },
          },
        },
      });

      if (!event) {
        throw new NotFoundError("Event not found");
      }

      // Check permissions (only creator or admin can delete)
      const isCreator = Number(event.created_by) === Number(userId);
      const isAdmin = userStatus === "admin";

      if (!isCreator && !isAdmin) {
        throw new ForbiddenError("You can only delete your own events");
      }

      // Delete event (cascade will delete registrations)
      await prisma.event.delete({
        where: { id: BigInt(eventId) },
      });

      logger.info("Event deleted successfully", {
        eventId,
        deletedBy: userId,
        hadRegistrations: event._count.registrations,
      });

      return { success: true };
    } catch (error) {
      logger.error("Error in DeleteEventUseCase", { error: error.message });
      throw error;
    }
  }
}
