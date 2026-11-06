import { ForbiddenError } from "../../../core/errors/AppError.js";
import { isCarsAdmin, isModerator } from "../../../core/utils/roles.js";
import { projectCarForViewer } from "./carAccess.js";

const sameId = (left, right) => String(left ?? "") === String(right ?? "");

/**
 * Use case for getting cars by user ID
 *
 * Маршрут публичным не был никогда по смыслу: им пользуется профиль, чтобы
 * показать свои машины. Открытым он означал «перебери id — получи чужой гараж»,
 * поэтому читать могут только сам владелец, администратор автомобилей и модерация.
 */
export class GetUserCarsUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(userId, viewer = null) {
    const isSelf = viewer?.user_id != null && sameId(userId, viewer.user_id);

    if (!isSelf && !isCarsAdmin(viewer) && !isModerator(viewer)) {
      throw new ForbiddenError("Список машин виден только его владельцу");
    }

    const cars = await this.carRepository.findByUserId(userId);

    return cars.map((car) => projectCarForViewer(car, viewer));
  }
}
