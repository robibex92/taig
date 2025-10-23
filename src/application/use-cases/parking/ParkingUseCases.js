import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      const spots = await prisma.parkingSpot.findMany({
        include: {
          owner: {
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
          owner: spot.owner
            ? {
                id: spot.owner.user_id,
                username: spot.owner.username,
                firstName: spot.owner.first_name,
                lastName: spot.owner.last_name,
                telegramFirstName: spot.owner.telegram_first_name,
                telegramLastName: spot.owner.telegram_last_name,
                avatar: spot.owner.avatar,
                displayName:
                  spot.owner.telegram_first_name ||
                  spot.owner.first_name ||
                  spot.owner.username ||
                  "Неизвестно",
              }
            : null,
        })),
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
        include: {
          owner: {
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
          history: {
            include: {
              changed_by: {
                select: {
                  user_id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
            orderBy: { changed_at: "desc" },
            take: 10,
          },
        },
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
          owner: spot.owner
            ? {
                id: spot.owner.user_id,
                username: spot.owner.username,
                firstName: spot.owner.first_name,
                lastName: spot.owner.last_name,
                telegramFirstName: spot.owner.telegram_first_name,
                telegramLastName: spot.owner.telegram_last_name,
                avatar: spot.owner.avatar,
                displayName:
                  spot.owner.telegram_first_name ||
                  spot.owner.first_name ||
                  spot.owner.username ||
                  "Неизвестно",
              }
            : null,
          history: spot.history.map((h) => ({
            id: h.id,
            fieldName: h.field_name,
            oldValue: h.old_value,
            newValue: h.new_value,
            changedAt: h.changed_at,
            changedBy: h.changed_by
              ? {
                  id: h.changed_by.user_id,
                  username: h.changed_by.username,
                  firstName: h.changed_by.first_name,
                  lastName: h.changed_by.last_name,
                  displayName:
                    h.changed_by.first_name ||
                    h.changed_by.username ||
                    "Система",
                }
              : null,
          })),
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
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      // Проверяем права на изменение
      if (spot.owner_id !== userId) {
        return {
          success: false,
          error: "You can only update your own parking spots",
        };
      }

      const oldData = { ...spot };
      const updatedSpot = await prisma.parkingSpot.update({
        where: { id: spotId },
        data: {
          status: updateData.status,
          price: updateData.price,
          description: updateData.description,
          contact_info: updateData.contactInfo,
          updated_at: new Date(),
        },
        include: {
          owner: {
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

      // Записываем историю изменений
      const changes = [];
      if (oldData.status !== updateData.status) {
        changes.push({
          parking_spot_id: spotId,
          field_name: "status",
          old_value: oldData.status,
          new_value: updateData.status,
          changed_by_id: userId,
        });
      }
      if (oldData.price !== updateData.price) {
        changes.push({
          parking_spot_id: spotId,
          field_name: "price",
          old_value: oldData.price,
          new_value: updateData.price,
          changed_by_id: userId,
        });
      }
      if (oldData.description !== updateData.description) {
        changes.push({
          parking_spot_id: spotId,
          field_name: "description",
          old_value: oldData.description,
          new_value: updateData.description,
          changed_by_id: userId,
        });
      }

      if (changes.length > 0) {
        await prisma.parkingSpotHistory.createMany({
          data: changes,
        });
      }

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
          owner: updatedSpot.owner
            ? {
                id: updatedSpot.owner.user_id,
                username: updatedSpot.owner.username,
                firstName: updatedSpot.owner.first_name,
                lastName: updatedSpot.owner.last_name,
                telegramFirstName: updatedSpot.owner.telegram_first_name,
                telegramLastName: updatedSpot.owner.telegram_last_name,
                avatar: updatedSpot.owner.avatar,
                displayName:
                  updatedSpot.owner.telegram_first_name ||
                  updatedSpot.owner.first_name ||
                  updatedSpot.owner.username ||
                  "Неизвестно",
              }
            : null,
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
        include: {
          owner: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
            },
          },
        },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      // Проверяем, не занято ли место уже другим пользователем
      if (spot.owner_id && Number(spot.owner_id) !== Number(ownerId)) {
        const ownerName =
          spot.owner?.username ||
          spot.owner?.first_name ||
          `ID: ${spot.owner_id}`;
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
        include: {
          owner: {
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

      // Записываем в историю
      await prisma.parkingSpotHistory.create({
        data: {
          parking_spot_id: spotId,
          field_name: "owner_id",
          old_value: oldOwnerId?.toString(),
          new_value: ownerId?.toString(),
          changed_by_id: assignedByUserId,
        },
      });

      return {
        success: true,
        data: {
          id: updatedSpot.id,
          spotNumber: updatedSpot.spot_number,
          owner: updatedSpot.owner
            ? {
                id: updatedSpot.owner.user_id,
                username: updatedSpot.owner.username,
                firstName: updatedSpot.owner.first_name,
                lastName: updatedSpot.owner.last_name,
                telegramFirstName: updatedSpot.owner.telegram_first_name,
                telegramLastName: updatedSpot.owner.telegram_last_name,
                avatar: updatedSpot.owner.avatar,
                displayName:
                  updatedSpot.owner.telegram_first_name ||
                  updatedSpot.owner.first_name ||
                  updatedSpot.owner.username ||
                  "Неизвестно",
              }
            : null,
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
        include: {
          owner: {
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
        include: { owner: true },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      if (!spot.owner_id) {
        return { success: false, error: "Parking spot has no owner" };
      }

      if (spot.owner_id === senderId) {
        return { success: false, error: "Cannot send message to yourself" };
      }

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

      return {
        success: true,
        data: {
          id: message.id,
          content: message.content,
          createdAt: message.created_at,
          sender: {
            id: message.sender.user_id,
            username: message.sender.username,
            firstName: message.sender.first_name,
            lastName: message.sender.last_name,
            telegramFirstName: message.sender.telegram_first_name,
            telegramLastName: message.sender.telegram_last_name,
            avatar: message.sender.avatar,
            displayName:
              message.sender.telegram_first_name ||
              message.sender.first_name ||
              message.sender.username ||
              "Неизвестно",
          },
          receiver: {
            id: message.receiver.user_id,
            username: message.receiver.username,
            firstName: message.receiver.first_name,
            lastName: message.receiver.last_name,
            telegramFirstName: message.receiver.telegram_first_name,
            telegramLastName: message.receiver.telegram_last_name,
            avatar: message.receiver.avatar,
            displayName:
              message.receiver.telegram_first_name ||
              message.receiver.first_name ||
              message.receiver.username ||
              "Неизвестно",
          },
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
}

export { ParkingUseCases, PARKING_STATUSES, PARKING_COLORS };
