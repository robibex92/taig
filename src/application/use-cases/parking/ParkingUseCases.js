import { prisma } from "../../../infrastructure/database/prisma.js";
import { messageDeliveryService } from "../../services/MessageDeliveryService.js";
import {
  ForbiddenError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { PARKING_STATUSES } from "../../../core/constants/parking.js";
import {
  canSeeSpotDetails,
  loadManageableSpot,
  loadSpot,
  OWNER_SELECT,
  toSpotId,
} from "./parkingAccess.js";
import { canViewResidentData } from "../../../core/utils/roles.js";

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

/**
 * Single serializer for parking spots.
 *
 * The public grid exposes only the place number and its status: price,
 * description, contacts and owner identity are resident data, included only
 * for staff (see `RESIDENT_DATA_ROLES`) or the owner of that exact place.
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

/** Поля места, за которыми следит история изменений. */
const TRACKED_FIELDS = [
  ["status", "status"],
  ["price", "price"],
  ["description", "description"],
  ["contact_info", "contact_info"],
];

/** Пара old_/new_ для `parking_spot_history` — одна на все способы изменения места. */
function historyValues(before, after) {
  const values = {};
  for (const [column, key] of TRACKED_FIELDS) {
    values[`old_${column}`] = before?.[key] ?? null;
    values[`new_${column}`] = after?.[key] ?? before?.[key] ?? null;
  }
  return values;
}

const STATS_KEY_BY_STATUS = {
  [PARKING_STATUSES.UNDEFINED]: "undefined",
  [PARKING_STATUSES.OWNED]: "owned",
  [PARKING_STATUSES.FOR_SALE]: "forSale",
  [PARKING_STATUSES.FOR_RENT]: "forRent",
  [PARKING_STATUSES.MAINTENANCE]: "maintenance",
  [PARKING_STATUSES.RESERVED]: "reserved",
};

/**
 * Данные места при создании/обновлении: HTTP-имена → колонки.
 * `undefined` означает «не трогать», `null` — «очистить».
 */
function toSpotData(input = {}, { forCreate = false } = {}) {
  const data = {
    status: input.status,
    price: input.price != null ? String(input.price) : null,
    description: input.description,
    contact_info: input.contactInfo,
  };

  if (!forCreate) return data;

  return {
    spot_number: input.spotNumber,
    floor: input.floor ?? 1,
    section: input.section ?? null,
    status: input.status || PARKING_STATUSES.UNDEFINED,
    price: input.price || null,
    description: input.description || null,
    contact_info: input.contactInfo || null,
    owner_id: input.ownerId ? BigInt(input.ownerId) : null,
    is_active: true,
  };
}

class ParkingUseCases {
  constructor({ delivery = messageDeliveryService } = {}) {
    this.delivery = delivery;
  }

  // Получить все парковочные места
  async getAllParkingSpots(viewer) {
    const detailed = canViewResidentData(viewer);

    const spots = await prisma.parkingSpot.findMany({
      orderBy: { spot_number: "asc" },
      include: detailed ? { owner: { select: OWNER_SELECT } } : undefined,
    });

    return {
      success: true,
      data: spots.map((spot) => mapSpot(spot, { detailed })),
    };
  }

  // Получить парковочное место по ID
  async getParkingSpotById(spotId, viewer) {
    const spot = await loadSpot(spotId, { withOwner: true });
    const detailed = canSeeSpotDetails(spot, viewer);

    return {
      success: true,
      data: {
        ...mapSpot(spot, { detailed }),
        history: detailed ? await this.#historyOf(spot.id) : [],
      },
    };
  }

  // История изменений места (данные жителя — только персоналу и владельцу)
  async getSpotHistory(spotId, viewer) {
    const spot = await loadSpot(spotId);

    if (!canSeeSpotDetails(spot, viewer)) {
      throw new ForbiddenError("Not authorized");
    }

    return { success: true, data: { spotId: Number(spot.id), history: await this.#historyOf(spot.id) } };
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

  async #recordHistory({ before, after, spotId, changedById, changeReason }) {
    await prisma.parkingSpotHistory.create({
      data: {
        parking_spot_id: spotId,
        changed_by_id: changedById,
        ...historyValues(before, after),
        ...(changeReason ? { change_reason: changeReason } : {}),
      },
    });
  }

  // Обновить парковочное место (владелец или администратор паркинга)
  async updateParkingSpot(spotId, updateData, user) {
    const id = toSpotId(spotId);
    const spot = await loadManageableSpot(
      id,
      user,
      "You can only update your own parking spots"
    );

    const updatedSpot = await prisma.parkingSpot.update({
      where: { id },
      data: { ...toSpotData(updateData), updated_at: new Date() },
      include: { owner: { select: OWNER_SELECT } },
    });

    await this.#recordHistory({
      before: spot,
      after: updatedSpot,
      spotId: id,
      changedById: user.user_id,
    });

    return { success: true, data: mapSpot(updatedSpot, { detailed: true }) };
  }

  // Назначить владельца парковочного места
  async assignOwner(spotId, ownerId, assignedByUserId) {
    const id = toSpotId(spotId);
    const spot = await loadSpot(id);

    // Проверяем, не занято ли место уже другим пользователем
    if (spot.owner_id && Number(spot.owner_id) !== Number(ownerId)) {
      throw new ValidationError(
        `Парковочное место №${spot.spot_number} уже принадлежит пользователю ID: ${spot.owner_id}. Сначала освободите место.`
      );
    }

    const updatedSpot = await prisma.parkingSpot.update({
      where: { id },
      data: { owner_id: ownerId, updated_at: new Date() },
      include: { owner: { select: OWNER_SELECT } },
    });

    await this.#recordHistory({
      before: spot,
      after: updatedSpot,
      spotId: id,
      changedById: assignedByUserId,
      changeReason: "Владелец назначен",
    });

    return { success: true, data: mapSpot(updatedSpot, { detailed: true }) };
  }

  // Освободить место от владельца (администратор паркинга)
  async unassignOwner(spotId, changedById) {
    const id = toSpotId(spotId);
    const spot = await loadSpot(id);

    if (!spot.owner_id) {
      throw new ValidationError("У места и так нет владельца");
    }

    const updatedSpot = await prisma.parkingSpot.update({
      where: { id },
      data: {
        owner_id: null,
        status: PARKING_STATUSES.UNDEFINED,
        updated_at: new Date(),
      },
    });

    await this.#recordHistory({
      before: spot,
      after: updatedSpot,
      spotId: id,
      changedById,
      changeReason: "Владелец снят с места",
    });

    return { success: true, data: mapSpot(updatedSpot, { detailed: true }) };
  }

  // Получить парковочные места пользователя
  async getUserParkingSpots(userId) {
    const spots = await prisma.parkingSpot.findMany({
      where: { owner_id: userId },
      orderBy: { spot_number: "asc" },
    });

    return {
      success: true,
      data: spots.map((spot) => mapSpot(spot, { detailed: true })),
    };
  }

  // Отправить сообщение владельцу парковочного места
  async sendMessageToOwner(spotId, senderId, content) {
    const id = toSpotId(spotId);
    const spot = await loadSpot(id);

    if (!spot.owner_id) {
      throw new ValidationError("Parking spot has no owner");
    }

    const message = await prisma.parkingMessage.create({
      data: {
        parking_spot_id: id,
        sender_id: senderId,
        receiver_id: spot.owner_id,
        content,
      },
      include: {
        sender: {
          select: {
            user_id: true,
            username: true,
            first_name: true,
            telegram_first_name: true,
          },
        },
        receiver: { select: { user_id: true } },
      },
    });

    // Уведомление владельцу: канал и id получателя выбирает сервис доставки,
    // разметка под него подставляется там же.
    const senderName = formatSenderName(message.sender);
    const delivery = await this.delivery.deliver({
      userId: message.receiver.user_id,
      text: (format) =>
        format === "plain"
          ? `📩 Новое сообщение по парковочному месту №${spot.spot_number}\n\n` +
            `💬 Сообщение: "${content}"\n\n` +
            `👤 От: ${senderName}`
          : `📩 Новое сообщение по парковочному месту №${spot.spot_number}\n\n` +
            `💬 Сообщение: <i>"${escapeHtml(content)}"</i>\n\n` +
            `👤 От: ${escapeHtml(senderName)}`,
    });

    if (!delivery.ok) {
      logger.warn("Parking notification not delivered", {
        spot_id: Number(id),
        code: delivery.code,
        error: delivery.error,
      });
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
  }

  // Получить статистику парковки
  async getParkingStats() {
    const [totalSpots, statusCounts] = await Promise.all([
      prisma.parkingSpot.count({ where: { is_active: true } }),
      prisma.parkingSpot.groupBy({
        by: ["status"],
        where: { is_active: true },
        _count: { status: true },
      }),
    ]);

    const stats = { totalSpots, ...Object.fromEntries(Object.values(STATS_KEY_BY_STATUS).map((key) => [key, 0])) };

    for (const row of statusCounts) {
      const key = STATS_KEY_BY_STATUS[row.status];
      if (key) stats[key] = row._count.status;
    }

    return { success: true, data: stats };
  }

  // Создать новое парковочное место (администратор паркинга)
  async createParkingSpot(spotData) {
    const existingSpot = await prisma.parkingSpot.findFirst({
      where: { spot_number: spotData.spotNumber },
    });

    if (existingSpot) {
      throw new ValidationError("Парковочное место с таким номером уже существует");
    }

    const newSpot = await prisma.parkingSpot.create({
      data: toSpotData(spotData, { forCreate: true }),
    });

    return { success: true, data: mapSpot(newSpot, { detailed: true }) };
  }

  // Удалить парковочное место (владелец или администратор паркинга)
  async deleteParkingSpot(spotId, user) {
    const id = toSpotId(spotId);
    await loadManageableSpot(id, user, "You are not authorized to delete this parking spot");

    // Сообщение и история висят на месте FK'ом — удаляем одним атомарным шагом,
    // иначе место остаётся с осиротевшими записями при неудаленном сообщении.
    await prisma.$transaction([
      prisma.parkingMessage.deleteMany({ where: { parking_spot_id: id } }),
      prisma.parkingSpotHistory.deleteMany({ where: { parking_spot_id: id } }),
      prisma.parkingSpot.delete({ where: { id } }),
    ]);

    return { success: true, message: "Парковочное место успешно удалено" };
  }
}

export { ParkingUseCases };
export { PARKING_STATUSES } from "../../../core/constants/parking.js";
export { PARKING_COLORS } from "../../../core/constants/parking.js";
