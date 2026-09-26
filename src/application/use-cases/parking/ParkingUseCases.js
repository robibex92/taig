import { PrismaClient } from "@prisma/client";
import { MessageDeliveryService } from "../../services/MessageDeliveryService.js";
import { canViewResidentData, isParkingAdmin } from "../../../core/utils/roles.js";

const prisma = new PrismaClient();

/** Текст уведомления экранируется: сообщение пишет пользователь, а разметка наша. */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

const OWNER_SELECT = {
  user_id: true,
  username: true,
  first_name: true,
  telegram_id: true,
  max_id: true,
};

/**
 * Single serializer for parking spots.
 *
 * The public grid exposes only the place number and its status: price,
 * description, contacts and owner identity are resident data, included only
 * for staff: administrator, moderator or parking administrator (or the owner
 * of that exact place).
 */
function mapSpot(spot, { detailed = false } = {}) {
  const base = {
    id: Number(spot.id),
    spotNumber: spot.spot_number,
    floor: spot.floor,
    section: spot.section,
    status: spot.status,
    isActive: spot.is_active,
    hasOwner: Boolean(spot.owner_id),
    createdAt: spot.created_at,
    updatedAt: spot.updated_at,
  };

  if (!detailed) return base;

  return {
    ...base,
    price: spot.price,
    description: spot.description,
    contactInfo: spot.contact_info,
    owner: spot.owner
      ? {
          id: Number(spot.owner.user_id),
          name: spot.owner.first_name || spot.owner.username || "Сосед",
          telegramId: spot.owner.telegram_id ? Number(spot.owner.telegram_id) : null,
          maxId: spot.owner.max_id ? Number(spot.owner.max_id) : null,
        }
      : spot.owner_id
        ? { id: Number(spot.owner_id) }
        : null,
  };
}

function isOwnerOf(spot, userId) {
  return userId != null && spot.owner_id != null && Number(spot.owner_id) === Number(userId);
}

class ParkingUseCases {
  constructor({ delivery = new MessageDeliveryService() } = {}) {
    this.delivery = delivery;
  }

  // Получить все парковочные места
  async getAllParkingSpots(viewer) {
    try {
      const detailed = canViewResidentData(viewer);

      const spots = await prisma.parkingSpot.findMany({
        orderBy: { spot_number: "asc" },
        include: detailed ? { owner: { select: OWNER_SELECT } } : undefined,
      });

      return {
        success: true,
        data: spots.map((spot) => mapSpot(spot, { detailed })),
      };
    } catch (error) {
      console.error("Error getting parking spots:", error);
      return { success: false, error: error.message };
    }
  }

  // Получить парковочное место по ID
  async getParkingSpotById(spotId, viewer) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
        include: { owner: { select: OWNER_SELECT } },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      const detailed =
        canViewResidentData(viewer) || isOwnerOf(spot, viewer?.user_id);

      return {
        success: true,
        data: { ...mapSpot(spot, { detailed }), history: detailed ? await this.#historyOf(spotId) : [] },
      };
    } catch (error) {
      console.error("Error getting parking spot:", error);
      return { success: false, error: error.message };
    }
  }

  async #historyOf(spotId) {
    const history = await prisma.parkingSpotHistory.findMany({
      where: { parking_spot_id: spotId },
      orderBy: { created_at: "desc" },
    });

    return history.map((entry) => ({
      id: Number(entry.id),
      changedAt: entry.created_at,
      changedById: entry.changed_by_id ? Number(entry.changed_by_id) : null,
      from: {
        status: entry.old_status,
        price: entry.old_price,
        description: entry.old_description,
      },
      to: { status: entry.new_status, price: entry.new_price, description: entry.new_description },
    }));
  }

  // Обновить парковочное место (владелец или администратор паркинга)
  async updateParkingSpot(spotId, updateData, user) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      if (!isParkingAdmin(user) && !isOwnerOf(spot, user?.user_id)) {
        return {
          success: false,
          error: "You can only update your own parking spots",
        };
      }

      const updatedSpot = await prisma.parkingSpot.update({
        where: { id: spotId },
        data: {
          status: updateData.status,
          price: updateData.price != null ? String(updateData.price) : null,
          description: updateData.description,
          contact_info: updateData.contactInfo,
          updated_at: new Date(),
        },
        include: { owner: { select: OWNER_SELECT } },
      });

      await prisma.parkingSpotHistory.create({
        data: {
          parking_spot_id: spotId,
          changed_by_id: user.user_id,
          old_status: spot.status,
          new_status: updatedSpot.status,
          old_price: spot.price,
          new_price: updatedSpot.price,
          old_description: spot.description,
          new_description: updatedSpot.description,
          old_contact_info: spot.contact_info,
          new_contact_info: updatedSpot.contact_info,
        },
      });

      return {
        success: true,
        data: mapSpot(updatedSpot, { detailed: true }),
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

      const updatedSpot = await prisma.parkingSpot.update({
        where: { id: spotId },
        data: {
          owner_id: ownerId,
          updated_at: new Date(),
        },
        include: { owner: { select: OWNER_SELECT } },
      });

      // Записываем в историю
      await prisma.parkingSpotHistory.create({
        data: {
          parking_spot_id: spotId,
          changed_by_id: assignedByUserId,
          old_status: spot.status,
          new_status: spot.status, // Статус не меняется при смене владельца
          old_price: spot.price,
          new_price: spot.price,
          old_description: spot.description,
          new_description: spot.description,
          old_contact_info: spot.contact_info,
          new_contact_info: spot.contact_info,
        },
      });

      return {
        success: true,
        data: mapSpot(updatedSpot, { detailed: true }),
      };
    } catch (error) {
      console.error("Error assigning owner:", error);
      return { success: false, error: error.message };
    }
  }

  // Освободить место от владельца (администратор паркинга)
  async unassignOwner(spotId, changedById) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
        include: { owner: { select: OWNER_SELECT } },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      if (!spot.owner_id) {
        return { success: false, error: "У места и так нет владельца" };
      }

      const updatedSpot = await prisma.parkingSpot.update({
        where: { id: spotId },
        data: {
          owner_id: null,
          status: PARKING_STATUSES.UNDEFINED,
          updated_at: new Date(),
        },
      });

      await prisma.parkingSpotHistory.create({
        data: {
          parking_spot_id: spotId,
          changed_by_id: changedById,
          old_status: spot.status,
          new_status: PARKING_STATUSES.UNDEFINED,
          old_price: spot.price,
          new_price: spot.price,
          old_description: spot.description,
          new_description: spot.description,
          old_contact_info: spot.contact_info,
          new_contact_info: spot.contact_info,
          change_reason: "Владелец снят с места",
        },
      });

      return {
        success: true,
        data: mapSpot(updatedSpot, { detailed: true }),
      };
    } catch (error) {
      console.error("Error unassigning owner:", error);
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
        data: spots.map((spot) => mapSpot(spot, { detailed: true })),
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

      // Уведомление владельцу: канал и id получателя выбирает сервис доставки.
      const recipientId = message.receiver.user_id;
      const availability = await this.delivery.availability({ userId: recipientId });
      const channel = availability.telegram
        ? "telegram"
        : availability.max
        ? "max"
        : null;

      let delivery = { ok: false, code: "no_channel", channels: availability };

      if (channel) {
        const senderName = formatSenderName(message.sender);
        const notificationText =
          channel === "telegram"
            ? `📩 Новое сообщение по парковочному месту №${spot.spot_number}\n\n` +
              `💬 Сообщение: <i>"${escapeHtml(content)}"</i>\n\n` +
              `👤 От: ${escapeHtml(senderName)}`
            : `📩 Новое сообщение по парковочному месту №${spot.spot_number}\n\n` +
              `💬 Сообщение: "${content}"\n\n` +
              `👤 От: ${senderName}`;

        delivery = await this.delivery.deliver({
          userId: recipientId,
          text: notificationText,
          channel,
        });

        if (!delivery.ok) {
          console.error("Parking notification not delivered:", delivery.code, delivery.error);
        }
      }

      return {
        success: true,
        data: {
          id: message.id,
          content: message.content,
          createdAt: message.created_at,
          delivered: delivery.ok,
          channel: delivery.channel ?? null,
          message: delivery.ok
            ? "Сообщение отправлено владельцу парковочного места"
            : "Сообщение сохранено, но доставить уведомление не удалось",
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

  // Создать новое парковочное место (администратор паркинга)
  async createParkingSpot(spotData) {
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
          floor: spotData.floor ?? 1,
          section: spotData.section ?? null,
          status: spotData.status || PARKING_STATUSES.UNDEFINED,
          price: spotData.price || null,
          description: spotData.description || null,
          contact_info: spotData.contactInfo || null,
          owner_id: spotData.ownerId ? BigInt(spotData.ownerId) : null,
          is_active: true,
        },
      });

      return {
        success: true,
        data: mapSpot(newSpot, { detailed: true }),
      };
    } catch (error) {
      console.error("Error creating parking spot:", error);
      return { success: false, error: error.message };
    }
  }

  // Удалить парковочное место (владелец или администратор паркинга)
  async deleteParkingSpot(spotId, user) {
    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found" };
      }

      if (!isParkingAdmin(user) && !isOwnerOf(spot, user?.user_id)) {
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

  // ---------- Служебные заметки администрации о месте ----------
  //
  // Отделяем от `description`: описание места видит покупатель, заметка — внутренняя
  // (кому жаловались, что обещали, нарушения). Читают и пишут только персонал,
  // поэтому ни одна из этих строк не попадает в публичный `mapSpot`.

  async getSpotNotes(spotId, user) {
    if (!canViewResidentData(user)) {
      return { success: false, error: "Not authorized", status: 403 };
    }

    try {
      const notes = await prisma.parkingSpotNote.findMany({
        where: { spot_id: BigInt(spotId) },
        orderBy: { created_at: "desc" },
      });

      const authors = await this.loadNoteAuthors(notes);

      return {
        success: true,
        data: notes.map((note) => ({
          id: Number(note.id),
          spotId: Number(note.spot_id),
          note: note.note,
          createdAt: note.created_at,
          createdByLabel: formatSenderName(authors.get(String(note.created_by_admin_id))),
        })),
      };
    } catch (error) {
      console.error("Error loading parking spot notes:", error);
      return { success: false, error: error.message };
    }
  }

  async addSpotNote(spotId, note, user) {
    if (!canViewResidentData(user)) {
      return { success: false, error: "Not authorized", status: 403 };
    }

    const text = String(note ?? "").trim();
    if (!text) {
      return { success: false, error: "Note content is required", status: 400 };
    }

    try {
      const spot = await prisma.parkingSpot.findUnique({
        where: { id: BigInt(spotId) },
      });

      if (!spot) {
        return { success: false, error: "Parking spot not found", status: 404 };
      }

      const created = await prisma.parkingSpotNote.create({
        data: {
          spot_id: spot.id,
          note: text,
          created_by_admin_id: BigInt(user.user_id),
        },
      });

      return {
        success: true,
        data: {
          id: Number(created.id),
          spotId: Number(created.spot_id),
          note: created.note,
          createdAt: created.created_at,
          createdByLabel: formatSenderName(user),
        },
      };
    } catch (error) {
      console.error("Error adding parking spot note:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteSpotNote(noteId, user) {
    if (!canViewResidentData(user)) {
      return { success: false, error: "Not authorized", status: 403 };
    }

    try {
      const deleted = await prisma.parkingSpotNote.deleteMany({
        where: { id: BigInt(noteId) },
      });

      if (!deleted.count) {
        return { success: false, error: "Note not found", status: 404 };
      }

      return { success: true, message: "Заметка удалена" };
    } catch (error) {
      console.error("Error deleting parking spot note:", error);
      return { success: false, error: error.message };
    }
  }

  /** Имена авторов одной пачкой — `formatSenderName` берёт @username, затем имя. */
  async loadNoteAuthors(notes) {
    const ids = [...new Set(notes.map((note) => String(note.created_by_admin_id)))];
    if (!ids.length) return new Map();

    const rows = await prisma.user.findMany({
      where: { user_id: { in: ids.map((id) => BigInt(id)) } },
      select: { user_id: true, username: true, first_name: true, telegram_first_name: true },
    });

    return new Map(rows.map((row) => [String(row.user_id), row]));
  }
}

export { ParkingUseCases, PARKING_STATUSES, PARKING_COLORS };
