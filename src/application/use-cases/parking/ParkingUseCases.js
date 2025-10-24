import { PrismaClient } from "@prisma/client";
import { TelegramService } from "../../services/TelegramService.js";

const prisma = new PrismaClient();

// Утилита для форматирования имени отправителя
function formatSenderName(sender) {
  if (!sender) return "Пользователь";

  // Приоритет: username (с @), затем telegram_first_name, затем first_name
  if (sender.username) {
    return `@${sender.username}`;
  }

  if (sender.telegram_first_name) {
    return sender.telegram_first_name;
  }

  if (sender.first_name) {
    return sender.first_name;
  }

  return "Пользователь";
}

// Parking Spot Statuses
const PARKING_STATUSES = {
  UNDEFINED: "undefined", // Серое - не определен
  OWNED: "owned", // Зеленое - во владении
  FOR_SALE: "for_sale", // Синее - продается
  FOR_RENT: "for_rent", // Оранжевое - аренда
  MAINTENANCE: "maintenance", // Красное - техническое обслуживание
  RESERVED: "reserved", // Фиолетовое - зарезервировано
};

// Parking Spot Colors (for frontend)
const PARKING_COLORS = {
  [PARKING_STATUSES.UNDEFINED]: "#9E9E9E", // Серый
  [PARKING_STATUSES.OWNED]: "#4CAF50", // Зеленый
  [PARKING_STATUSES.FOR_SALE]: "#2196F3", // Синий
  [PARKING_STATUSES.FOR_RENT]: "#FF9800", // Оранжевый
  [PARKING_STATUSES.MAINTENANCE]: "#F44336", // Красный
  [PARKING_STATUSES.RESERVED]: "#9C27B0", // Фиолетовый
};

class ParkingUseCases {
  // Получить все парковочные места
  async getAllParkingSpots() {
    try {
      console.log("ParkingUseCases.getAllParkingSpots called");
      const spots = await prisma.parkingSpot.findMany({
        orderBy: { spot_number: "asc" },
      });

      // Проверяем только наличие владельца, без загрузки его личных данных
      const spotsWithOwners = spots.map((spot) => ({
        ...spot,
        hasOwner: !!spot.owner_id,
      }));

      const mappedSpots = spotsWithOwners.map((spot) => ({
        id: spot.id,
        spotNumber: spot.spot_number,
        floor: spot.floor,
        section: spot.section,
        status: spot.status,
        price: spot.price,
        description: spot.description,
        contactInfo: spot.contact_info,
        isActive: spot.is_active,
        createdAt: spot.created_at,
        updatedAt: spot.updated_at,
        hasOwner: spot.hasOwner,
      }));

      console.log("ParkingUseCases.getAllParkingSpots result:", {
        totalSpots: mappedSpots.length,
        spotsWithOwners: mappedSpots.filter((s) => s.hasOwner).length,
        sampleSpot: mappedSpots.find((s) => s.spotNumber === "27"),
      });

      return {
        success: true,
        data: mappedSpots,
      };
    } catch (error) {
      console.error("Error getting parking spots:", error);
      return { success: false, error: error.message };
    }
  }

  // Получить парковочное место по ID
  async getParkingSpotById(spotId) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      return {
        success: true,
        data: {
          id: spot.id,
          spotNumber: spot.spot_number,
          floor: spot.floor,
          section: spot.section,
          status: spot.status,
          price: spot.price,
          description: spot.description,
          contactInfo: spot.contact_info,
          isActive: spot.is_active,
          createdAt: spot.created_at,
          updatedAt: spot.updated_at,
          owner: spot.owner_id ? { id: spot.owner_id } : null,
          history: [],
        },
      };
    } catch (error) {
      console.error("Error getting parking spot:", error);
      return { success: false, error: error.message };
    }
  }

  // Обновить парковочное место
  async updateParkingSpot(spotId, updateData, userId) {
    try {
      console.log("ParkingUseCases.updateParkingSpot called with:", {
        spotId,
        updateData,
        userId,
      });

      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      console.log("Found spot:", spot);

      if (!spot) {
        console.log("Spot not found");
        return { success: false, error: "Parking spot not found" };
      }

      // Проверяем права на изменение
      if (spot.owner_id !== userId) {
        console.log("User not authorized to update this spot");
        return {
          success: false,
          error: "You can only update your own parking spots",
        };
      }

      const oldData = { ...spot };

      const updateDataForDB = {
        spot_number: updateData.spotNumber,
        status: updateData.status,
        price: updateData.price ? String(updateData.price) : null,
        description: updateData.description,
        contact_info: updateData.contactInfo,
        updated_at: new Date(),
      };

      console.log("Updating spot with data:", updateDataForDB);

      const updatedSpot = await prisma.parkingSpot.update({
        where: { id: spotId },
        data: updateDataForDB,
      });

      console.log("Parking spot updated successfully:", updatedSpot);

      // Записываем историю изменений
      const historyData = {
        parking_spot_id: spotId,
        changed_by_id: userId,
        old_status: oldData.status,
        new_status: updateData.status,
        old_price: oldData.price ? String(oldData.price) : null,
        new_price: updateData.price ? String(updateData.price) : null,
        old_description: oldData.description,
        new_description: updateData.description,
        old_contact_info: oldData.contact_info,
        new_contact_info: updateData.contactInfo,
      };

      // Создаем запись истории изменений
      await prisma.parkingSpotHistory.create({
        data: historyData,
      });

      return {
        success: true,
        data: {
          id: updatedSpot.id,
          spotNumber: updatedSpot.spot_number,
          floor: updatedSpot.floor,
          section: updatedSpot.section,
          status: updatedSpot.status,
          price: updatedSpot.price,
          description: updatedSpot.description,
          contactInfo: updatedSpot.contact_info,
          isActive: updatedSpot.is_active,
          createdAt: updatedSpot.created_at,
          updatedAt: updatedSpot.updated_at,
          owner: updatedSpot.owner_id ? { id: updatedSpot.owner_id } : null,
        },
      };
    } catch (error) {
      console.error("Error updating parking spot:", error);
      return { success: false, error: error.message };
    }
  }

  // Назначить владельца парковочного места
  async assignOwner(spotId, ownerId, assignedByUserId) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      // Проверяем, не занято ли место уже другим пользователем
      if (spot.owner_id && Number(spot.owner_id) !== Number(ownerId)) {
        const ownerName = `ID: ${spot.owner_id}`;
        return {
          success: false,
          error: `Парковочное место №${spot.spot_number} уже принадлежит пользователю ${ownerName}. Сначала освободите место.`,
        };
      }

      const oldOwnerId = spot.owner_id;
      const updatedSpot = await prisma.parkingSpot.update({
        where: { id: spotId },
        data: {
          owner_id: ownerId,
          updated_at: new Date(),
        },
      });

      // Записываем в историю
      await prisma.parkingSpotHistory.create({
        data: {
          parking_spot_id: spotId,
          changed_by_id: assignedByUserId,
          old_status: spot.status,
          new_status: spot.status, // Статус не меняется при смене владельца
          old_price: spot.price ? String(spot.price) : null,
          new_price: spot.price ? String(spot.price) : null,
          old_description: spot.description,
          new_description: spot.description,
          old_contact_info: spot.contact_info,
          new_contact_info: spot.contact_info,
        },
      });

      return {
        success: true,
        data: {
          id: updatedSpot.id,
          spotNumber: updatedSpot.spot_number,
          owner: updatedSpot.owner_id ? { id: updatedSpot.owner_id } : null,
        },
      };
    } catch (error) {
      console.error("Error assigning owner:", error);
      return { success: false, error: error.message };
    }
  }

  // Получить парковочные места пользователя
  async getUserParkingSpots(userId) {
    try {
      const spots = await prisma.parkingSpot.findMany({
        where: { owner_id: userId },
        orderBy: { spot_number: "asc" },
      });

      return {
        success: true,
        data: spots.map((spot) => ({
          id: spot.id,
          spotNumber: spot.spot_number,
          floor: spot.floor,
          section: spot.section,
          status: spot.status,
          price: spot.price,
          description: spot.description,
          contactInfo: spot.contact_info,
          isActive: spot.is_active,
          createdAt: spot.created_at,
          updatedAt: spot.updated_at,
        })),
      };
    } catch (error) {
      console.error("Error getting user parking spots:", error);
      return { success: false, error: error.message };
    }
  }

  // Отправить сообщение владельцу парковочного места
  async sendMessageToOwner(spotId, senderId, content) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      if (!spot.owner_id) {
        return { success: false, error: "Parking spot has no owner" };
      }

      // Убираем ограничение на отправку сообщений самому себе для парковочных мест
      // if (spot.owner_id === senderId) {
      //   return { success: false, error: "Cannot send message to yourself" };
      // }

      const message = await prisma.parkingMessage.create({
        data: {
          parking_spot_id: spotId,
          sender_id: senderId,
          receiver_id: spot.owner_id,
          content: content,
        },
        include: {
          sender: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
              telegram_first_name: true,
              telegram_last_name: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
              telegram_first_name: true,
              telegram_last_name: true,
              avatar: true,
            },
          },
        },
      });

      // Отправляем уведомление в Telegram владельцу
      try {
        const telegramService = new TelegramService();
        const notificationText =
          `📩 Новое сообщение по парковочному месту №${spot.spot_number}\n\n` +
          `💬 Сообщение: <i>"${content}"</i>\n\n` +
          `👤 От: ${formatSenderName(message.sender)}`;

        await telegramService.sendMessage({
          message: notificationText,
          chatIds: [message.receiver.user_id.toString()],
          parse_mode: "HTML",
        });
      } catch (telegramError) {
        console.error("Error sending Telegram notification:", telegramError);
        // Не прерываем выполнение, если Telegram недоступен
      }

      return {
        success: true,
        data: {
          id: message.id,
          content: message.content,
          createdAt: message.created_at,
          message: "Сообщение отправлено владельцу парковочного места",
        },
      };
    } catch (error) {
      console.error("Error sending message:", error);
      return { success: false, error: error.message };
    }
  }

  // Получить статистику парковки
  async getParkingStats() {
    try {
      const totalSpots = await prisma.parkingSpot.count({
        where: { is_active: true },
      });

      const statusCounts = await prisma.parkingSpot.groupBy({
        by: ["status"],
        where: { is_active: true },
        _count: { status: true },
      });

      const stats = {
        totalSpots,
        undefined: 0,
        owned: 0,
        forSale: 0,
        forRent: 0,
        maintenance: 0,
        reserved: 0,
      };

      statusCounts.forEach((item) => {
        switch (item.status) {
          case PARKING_STATUSES.UNDEFINED:
            stats.undefined = item._count.status;
            break;
          case PARKING_STATUSES.OWNED:
            stats.owned = item._count.status;
            break;
          case PARKING_STATUSES.FOR_SALE:
            stats.forSale = item._count.status;
            break;
          case PARKING_STATUSES.FOR_RENT:
            stats.forRent = item._count.status;
            break;
          case PARKING_STATUSES.MAINTENANCE:
            stats.maintenance = item._count.status;
            break;
          case PARKING_STATUSES.RESERVED:
            stats.reserved = item._count.status;
            break;
        }
      });

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("Error getting parking stats:", error);
      return { success: false, error: error.message };
    }
  }

  // Создать новое парковочное место
  async createParkingSpot(spotData, userId) {
    try {
      // Валидация входных данных
      if (!spotData.spotNumber) {
        throw new Error("Номер парковочного места обязателен");
      }

      // Проверяем, не существует ли уже такое место (только по номеру)
      const existingSpot = await prisma.parkingSpot.findFirst({
        where: {
          spot_number: spotData.spotNumber,
        },
      });

      if (existingSpot) {
        throw new Error("Парковочное место с таким номером уже существует");
      }

      // Создаем новое парковочное место
      const newSpot = await prisma.parkingSpot.create({
        data: {
          spot_number: spotData.spotNumber,
          floor: 1, // Значение по умолчанию
          section: null, // Секция не используется
          status: spotData.status || PARKING_STATUSES.UNDEFINED,
          price: spotData.price || null,
          description: spotData.description || null,
          contact_info: spotData.contactInfo || null,
          owner_id: userId,
          is_active: true,
        },
      });

      return {
        success: true,
        data: {
          id: newSpot.id,
          spotNumber: newSpot.spot_number,
          floor: newSpot.floor,
          section: newSpot.section,
          status: newSpot.status,
          price: newSpot.price,
          description: newSpot.description,
          contactInfo: newSpot.contact_info,
          isActive: newSpot.is_active,
          createdAt: newSpot.created_at,
          updatedAt: newSpot.updated_at,
          owner: userId ? { id: userId } : null,
        },
      };
    } catch (error) {
      console.error("Error creating parking spot:", error);
      return { success: false, error: error.message };
    }
  }

  // Удалить парковочное место (только владелец)
  async deleteParkingSpot(spotId, userId) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      // Проверяем, что пользователь является владельцем места
      if (spot.owner_id !== userId) {
        return {
          success: false,
          error: "You are not authorized to delete this parking spot",
        };
      }

      // Сначала удаляем связанные сообщения
      await prisma.parkingMessage.deleteMany({
        where: { parking_spot_id: spotId },
      });

      // Удаляем историю изменений
      await prisma.parkingSpotHistory.deleteMany({
        where: { parking_spot_id: spotId },
      });

      // Удаляем само парковочное место
      await prisma.parkingSpot.delete({
        where: { id: spotId },
      });

      return {
        success: true,
        message: "Парковочное место успешно удалено",
      };
    } catch (error) {
      console.error("Error deleting parking spot:", error);
      return { success: false, error: error.message };
    }
  }
}

export { ParkingUseCases, PARKING_STATUSES, PARKING_COLORS };
