import { prisma } from "../../../infrastructure/database/prisma.js";
import { NotFoundError } from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Get Event By ID Use Case
 * Retrieves a single event with full details
 */
export class GetEventByIdUseCase {
  async execute(eventId) {
    try {
      const event = await prisma.event.findUnique({
        where: { id: BigInt(eventId) },
        include: {
          creator: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
              avatar: true,
            },
          },
          registrations: {
            include: {
              user: {
                select: {
                  user_id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                  avatar: true,
                },
              },
            },
            orderBy: { registered_at: "asc" },
          },
        },
      });

      if (!event) {
        throw new NotFoundError("Event not found");
      }

      logger.info("Event retrieved successfully", { eventId });

      return {
        id: Number(event.id),
        title: event.title,
        description: event.description,
        event_type: event.event_type,
        location: event.location,
        start_date: event.start_date.toISOString(),
        end_date: event.end_date ? event.end_date.toISOString() : null,
        max_participants: event.max_participants,
        status: event.status,
        created_by: Number(event.created_by),
        created_at: event.created_at.toISOString(),
        updated_at: event.updated_at.toISOString(),
        creator: event.creator
          ? {
              first_name: event.creator.first_name,
              last_name: event.creator.last_name,
              username: event.creator.username,
            }
          : null,
        registrations: event.registrations.map((reg) => ({
          id: Number(reg.id),
          status: reg.status,
          registered_at: reg.registered_at.toISOString(),
          user: {
            user_id: Number(reg.user.user_id),
            username: reg.user.username,
            first_name: reg.user.first_name,
            last_name: reg.user.last_name,
          },
        })),
      };
    } catch (error) {
      logger.error("Error in GetEventByIdUseCase", { error: error.message });
      throw error;
    }
  }
}
