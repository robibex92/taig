import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Update Event Use Case
 * Updates an existing event (only by creator or admin)
 */
export class UpdateEventUseCase {
  async execute(eventId, updateData, userId, userStatus) {
    try {
      // Find event
      const event = await prisma.event.findUnique({
        where: { id: BigInt(eventId) },
      });

      if (!event) {
        throw new NotFoundError("Event not found");
      }

      // Check permissions (only creator or admin can update)
      const isCreator = Number(event.created_by) === Number(userId);
      const isAdmin = userStatus === "admin";

      if (!isCreator && !isAdmin) {
        throw new ForbiddenError("You can only edit your own events");
      }

      // Prepare update data
      const data = {};
      if (updateData.title !== undefined) data.title = updateData.title.trim();
      if (updateData.description !== undefined)
        data.description = updateData.description?.trim() || null;
      if (updateData.image_url !== undefined)
        data.image_url = updateData.image_url?.trim() || null;
      if (updateData.event_type !== undefined)
        data.event_type = updateData.event_type;
      if (updateData.location !== undefined)
        data.location = updateData.location?.trim() || null;
      if (updateData.max_participants !== undefined)
        data.max_participants = updateData.max_participants || null;
      if (updateData.status !== undefined) data.status = updateData.status;

      // Handle date updates with conflict checking
      if (updateData.start_date !== undefined) {
        const startDate = new Date(updateData.start_date);
        if (isNaN(startDate.getTime())) {
          throw new ValidationError("Некорректная дата начала");
        }
        data.start_date = startDate;
      }

      if (updateData.end_date !== undefined) {
        const endDate = updateData.end_date
          ? new Date(updateData.end_date)
          : null;
        if (endDate && isNaN(endDate.getTime())) {
          throw new ValidationError("Некорректная дата окончания");
        }
        data.end_date = endDate;
      }

      // Validate dates if being updated
      if (data.start_date || data.end_date) {
        const finalStartDate = data.start_date || event.start_date;
        const finalEndDate =
          data.end_date !== undefined ? data.end_date : event.end_date;

        if (finalEndDate && finalEndDate <= finalStartDate) {
          throw new ValidationError(
            "Дата окончания должна быть позже даты начала"
          );
        }
      }

      // Update event
      const updatedEvent = await prisma.event.update({
        where: { id: BigInt(eventId) },
        data,
        include: {
          creator: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      logger.info("Event updated successfully", {
        eventId,
        updatedBy: userId,
      });

      return {
        id: Number(updatedEvent.id),
        title: updatedEvent.title,
        description: updatedEvent.description,
        event_type: updatedEvent.event_type,
        location: updatedEvent.location,
        start_date: updatedEvent.start_date.toISOString(),
        end_date: updatedEvent.end_date
          ? updatedEvent.end_date.toISOString()
          : null,
        max_participants: updatedEvent.max_participants,
        status: updatedEvent.status,
        created_by: Number(updatedEvent.created_by),
        created_at: updatedEvent.created_at.toISOString(),
        updated_at: updatedEvent.updated_at.toISOString(),
      };
    } catch (error) {
      logger.error("Error in UpdateEventUseCase", { error: error.message });
      throw error;
    }
  }
}
