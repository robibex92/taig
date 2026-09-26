import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import { canViewResidentData, isParkingAdmin } from "../../../core/utils/roles.js";

/**
 * Доступ к парковочным местам — тот же слой, что `carAccess.js` для авто:
 * проверка существования и прав отделена от бизнес-кейсов, чтобы текст ошибки
 * и HTTP-код не собирались заново в каждом методе.
 */

export const OWNER_SELECT = {
  user_id: true,
  username: true,
  first_name: true,
  telegram_id: true,
  max_id: true,
};

/**
 * Из HTTP приходит строка, колонка — BigInt. `BigInt("abc")` бросает
 * SyntaxError, поэтому наружу идёт 400, а не 500.
 */
export function toSpotId(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    throw new ValidationError("Некорректный номер парковочного места");
  }
  return BigInt(raw);
}

export const isOwnerOfSpot = (spot, userId) =>
  userId != null &&
  spot?.owner_id != null &&
  Number(spot.owner_id) === Number(userId);

/**
 * Кто видит данные жителя в карточке одного места: персонал (см.
 * `RESIDENT_DATA_ROLES`) либо владелец именно этого места.
 */
export const canSeeSpotDetails = (spot, user) =>
  canViewResidentData(user) || isOwnerOfSpot(spot, user?.user_id);

export async function loadSpot(spotId, { withOwner = false } = {}) {
  const spot = await prisma.parkingSpot.findUnique({
    where: { id: toSpotId(spotId) },
    ...(withOwner && { include: { owner: { select: OWNER_SELECT } } }),
  });

  if (!spot) {
    throw new NotFoundError("Parking spot");
  }

  return spot;
}

/** Менять и удалять место может администратор паркинга или его владелец. */
export async function loadManageableSpot(spotId, user, failureMessage) {
  const spot = await loadSpot(spotId);

  if (!isParkingAdmin(user) && !isOwnerOfSpot(spot, user?.user_id)) {
    throw new ForbiddenError(failureMessage);
  }

  return spot;
}
