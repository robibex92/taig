import { ForbiddenError, NotFoundError } from "../../../core/errors/AppError.js";
import { isCarsAdmin } from "../../../core/utils/roles.js";

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
    Number(car.user_id) === Number(user.user_id);

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
