import { ForbiddenError, NotFoundError } from "../../../core/errors/AppError.js";
import { isCarsAdmin, isModerator } from "../../../core/utils/roles.js";

/** `user_id` из Prisma — BigInt, из токена — строка/число. */
const sameId = (left, right) => String(left ?? "") === String(right ?? "");

/**
 * A resident may only manage the cars registered to them; `cars:admin` may
 * manage any car. Both also need the car to exist.
 */
export async function loadManageableCar(carRepository, carId, user, action) {
  const car = await carRepository.findById(carId);

  if (!car) {
    throw new NotFoundError("Car");
  }

  const isOwner =
    user?.user_id != null &&
    car.user_id != null &&
    sameId(car.user_id, user.user_id);

  if (!isCarsAdmin(user) && !isOwner) {
    throw new ForbiddenError(`You can only ${action} your own cars`);
  }

  return car;
}

/** Ownership and visibility are admin-only edits. */
export function withoutAdminOnlyFields(updateData, user) {
  if (isCarsAdmin(user)) return updateData;
  const { user_id, status, ...rest } = updateData;
  return rest;
}

/**
 * Что знает смотритель об одной машине.
 *
 * Номер, марка, модель и цвет публичны — страница «Чей авто» ровно по ним и
 * ищет. `user_id` — нет: в этом проекте это id Telegram, и в связке с
 * `GET /api/users/:id` он превращал парковку в список «кто где живёт». Владелец и
 * администратор автомобилей (как и модерация, которая отвечает соседям) получают
 * строку целиком; остальные — то же без `user_id`, но с `has_owner`, чтобы
 * интерфейс мог честно сказать «владелец отмечен».
 */
export function projectCarForViewer(car, viewer = null) {
  if (!car) return car;

  const row = typeof car.toJSON === "function" ? car.toJSON() : { ...car };
  const isOwner = viewer?.user_id != null && sameId(row.user_id, viewer.user_id);
  const hasOwner = row.user_id != null;

  if (isOwner || isCarsAdmin(viewer) || isModerator(viewer)) {
    return { ...row, is_owner: isOwner, has_owner: hasOwner };
  }

  const { user_id, ...rest } = row;

  return { ...rest, is_owner: false, has_owner: hasOwner };
}
