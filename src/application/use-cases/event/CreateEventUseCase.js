import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  ValidationError,
  ForbiddenError,
} from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Create Event Use Case
 * Creates a new event with time conflict checking
 */
export class CreateEventUseCase {
  async execute(eventData, userId) {
    try {
      const {
        title,
        description,
        image_url,
        event_type = "general",
        location,
        start_date,
        end_date,
        max_participants,
        telegram_chat_ids = [], // Массив ID Telegram чатов для дублирования
      } = eventData;

      // Validate required fields
      if (!title || title.trim().length === 0) {
        throw new ValidationError("Название события обязательно");
      }

      if (!start_date) {
        throw new ValidationError("Дата начала события обязательна");
      }

      const startDate = new Date(start_date);
      const endDate = end_date ? new Date(end_date) : null;

      // Validate dates
      if (isNaN(startDate.getTime())) {
        throw new ValidationError("Некорректная дата начала");
      }

      if (endDate && isNaN(endDate.getTime())) {
        throw new ValidationError("Некорректная дата окончания");
      }

      if (endDate && endDate <= startDate) {
        throw new ValidationError(
          "Дата окончания должна быть позже даты начала"
        );
      }

      // Create event (без проверки конфликтов - можно создавать параллельные события)
      const event = await prisma.event.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          image_url: image_url?.trim() || null,
          event_type,
          location: location?.trim() || null,
          start_date: startDate,
          end_date: endDate,
          max_participants: max_participants || null,
          status: "active",
          created_by: BigInt(userId),
          // Создаем связи с Telegram чатами
          telegram_chats: {
            create: telegram_chat_ids.map((chatId) => ({
              telegram_chat_id: chatId,
              message_sent: false,
            })),
          },
        },
        include: {
          creator: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          telegram_chats: {
            include: {
              telegram_chat: true,
            },
          },
        },
      });

      logger.info("Event created successfully", {
        eventId: event.id,
        title: event.title,
        createdBy: userId,
      });

      return {
        id: Number(event.id),
        title: event.title,
        description: event.description,
        image_url: event.image_url,
        event_type: event.event_type,
        location: event.location,
        start_date: event.start_date.toISOString(),
        end_date: event.end_date ? event.end_date.toISOString() : null,
        max_participants: event.max_participants,
        status: event.status,
        created_by: Number(event.created_by),
        created_at: event.created_at.toISOString(),
        updated_at: event.updated_at.toISOString(),
        telegram_chats: event.telegram_chats || [],
      };
    } catch (error) {
      logger.error("Error in CreateEventUseCase", { error: error.message });
      throw error;
    }
  }
}
