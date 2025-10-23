import { prisma } from "../../../infrastructure/database/prisma.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Get Events Use Case
 * Retrieves events with filtering and pagination
 */
export class GetEventsUseCase {
  async execute(filters = {}, pagination = {}) {
    try {
      const { status, event_type } = filters;
      const { page = 0, limit = 10 } = pagination;

      // Build where clause
      const where = {};
      if (status) where.status = status;
      if (event_type) where.event_type = event_type;

      // Get total count
      const total = await prisma.event.count({ where });

      // Get events with relations
      const events = await prisma.event.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { start_date: "asc" },
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
            where: { status: "registered" },
            select: {
              id: true,
              status: true,
              registered_at: true,
              user: {
                select: {
                  user_id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
      });

      // Transform data
      const transformedEvents = events.map((event) => ({
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
        registrations: event.registrations || [],
      }));

      logger.info("Events retrieved successfully", {
        count: transformedEvents.length,
        total,
      });

      return {
        events: transformedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Error in GetEventsUseCase", { error: error.message });
      throw error;
    }
  }
}
