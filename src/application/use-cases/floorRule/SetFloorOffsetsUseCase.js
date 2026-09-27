import { ForbiddenError, ValidationError } from "../../../core/errors/AppError.js";
import { canManageHouse } from "../../../core/utils/roles.js";
import { HOUSE_FLOOR_MAX, HOUSE_ROW_OFFSET_MAX } from "../../../core/constants/index.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * SetFloorOffsetsUseCase
 * Отступ ряда слева для подъезда: «с какой ячейки начинать» сразу для набора
 * этажей. Один запрос вместо POST /floor-rules на каждый этаж.
 *
 * `position` — номер ячейки начала ряда, 1 = без отступа. Это ровно то же поле,
 * которое витрина читает из `floor_rules`, поэтому правка переживает перезагрузку
 * и не конфликтует с закрепленными колонками отдельных квартир.
 */
export class SetFloorOffsetsUseCase {
  static MAX_FLOORS_PER_REQUEST = 60;

  constructor(floorRuleRepository) {
    this.floorRuleRepository = floorRuleRepository;
  }

  async execute({ house, entrance, floors, position }, user) {
    if (!house || !Number.isInteger(entrance)) {
      throw new ValidationError("house and entrance are required");
    }

    if (!canManageHouse(user, house)) {
      throw new ForbiddenError("Только управляющие домом могут менять отступ ряда");
    }

    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > HOUSE_ROW_OFFSET_MAX
    ) {
      throw new ValidationError(
        `position must be an integer from 1 to ${HOUSE_ROW_OFFSET_MAX}`
      );
    }

    const list = Array.isArray(floors) ? [...new Set(floors.map(Number))] : [];

    if (!list.length || list.length > SetFloorOffsetsUseCase.MAX_FLOORS_PER_REQUEST) {
      throw new ValidationError("floors must be a non-empty list");
    }

    if (list.some((floor) => !Number.isInteger(floor) || floor < 1 || floor > HOUSE_FLOOR_MAX)) {
      throw new ValidationError(`floors must be integers from 1 to ${HOUSE_FLOOR_MAX}`);
    }

    const updated = [];

    for (const floor of list.sort((a, b) => a - b)) {
      updated.push(
        await this.floorRuleRepository.upsert({ house, entrance, floor, position })
      );
    }

    logger.info("Floor row offsets updated", {
      house,
      entrance,
      position,
      floors: list.length,
      userId: user?.user_id,
    });

    return updated;
  }
}
