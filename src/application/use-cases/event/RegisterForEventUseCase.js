import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Register For Event Use Case
 * Registers a user/guest for an event with capacity checking and waitlist support
 */
export class RegisterForEventUseCase {
  async execute(eventId, userId = null, registrationData = {}) {
    try {
      const { notes, guest_name, guest_phone, guest_email } = registrationData;

      // Validate guest data if not authenticated
      if (!userId) {
        if (!guest_name || guest_name.trim().length === 0) {
          throw new ValidationError("Имя гостя обязательно");
        }
        if (!guest_phone && !guest_email) {
          throw new ValidationError(
            "Необходимо указать телефон или email для связи"
          );
        }
      }

      // Find event
      const event = await prisma.event.findUnique({
        where: { id: BigInt(eventId) },
        include: {
          _count: {
            select: { registrations: { where: { status: "registered" } } },
          },
        },
      });

      if (!event) {
        throw new NotFoundError("Event not found");
      }

      if (event.status !== "active") {
        throw new ValidationError("Event is not active");
      }

      // Check if event is in the past
      if (new Date(event.start_date) < new Date()) {
        throw new ValidationError("Cannot register for past events");
      }

      // Check if already registered (for authenticated users)
      if (userId) {
        const existingRegistration = await prisma.eventRegistration.findUnique({
          where: {
            event_id_user_id: {
              event_id: BigInt(eventId),
              user_id: BigInt(userId),
            },
          },
        });

        if (existingRegistration) {
          if (existingRegistration.status === "registered") {
            throw new ValidationError("Already registered for this event");
          }

          // Reactivate cancelled registration
          const updated = await prisma.eventRegistration.update({
            where: { id: existingRegistration.id },
            data: {
              status: "registered",
              notes: notes?.trim() || null,
            },
          });

          logger.info("Event registration reactivated", {
            eventId,
            userId,
          });

          return {
            id: Number(updated.id),
            event_id: Number(updated.event_id),
            user_id: Number(updated.user_id),
            status: updated.status,
            notes: updated.notes,
            registered_at: updated.registered_at.toISOString(),
            waitlisted: false,
          };
        }
      }

      // Check capacity
      const isFull =
        event.max_participants &&
        event._count.registrations >= event.max_participants;

      if (isFull) {
        // Add to waitlist
        const waitlistEntry = await prisma.eventWaitlist.create({
          data: {
            event_id: BigInt(eventId),
            user_id: userId ? BigInt(userId) : null,
            guest_name: guest_name?.trim() || null,
            guest_phone: guest_phone?.trim() || null,
            guest_email: guest_email?.trim() || null,
            notes: notes?.trim() || null,
            notified: false,
          },
        });

        logger.info("User added to event waitlist", {
          eventId,
          userId,
          waitlistId: waitlistEntry.id,
        });

        return {
          id: Number(waitlistEntry.id),
          event_id: Number(waitlistEntry.event_id),
          user_id: userId ? Number(userId) : null,
          status: "waitlisted",
          notes: waitlistEntry.notes,
          registered_at: waitlistEntry.created_at.toISOString(),
          waitlisted: true,
          message:
            "Мест нет. Вы добавлены в лист ожидания. Мы уведомим вас, если место освободится.",
        };
      }

      // Create new registration
      const registration = await prisma.eventRegistration.create({
        data: {
          event_id: BigInt(eventId),
          user_id: userId ? BigInt(userId) : null,
          status: "registered",
          notes: notes?.trim() || null,
          guest_name: guest_name?.trim() || null,
          guest_phone: guest_phone?.trim() || null,
          guest_email: guest_email?.trim() || null,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              start_date: true,
              creator: {
                select: {
                  user_id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          user: userId
            ? {
                select: {
                  user_id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                },
              }
            : undefined,
        },
      });

      logger.info("User registered for event", {
        eventId,
        userId,
        isGuest: !userId,
        eventTitle: registration.event.title,
      });

      // TODO: Send Telegram notification to event creator
      // This can be implemented later using the telegram service

      return {
        id: Number(registration.id),
        event_id: Number(registration.event_id),
        user_id: userId ? Number(userId) : null,
        status: registration.status,
        notes: registration.notes,
        guest_name: registration.guest_name,
        guest_phone: registration.guest_phone,
        guest_email: registration.guest_email,
        registered_at: registration.registered_at.toISOString(),
        waitlisted: false,
      };
    } catch (error) {
      logger.error("Error in RegisterForEventUseCase", {
        error: error.message,
      });
      throw error;
    }
  }
}
