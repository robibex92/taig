import {
  ValidationError,
} from "../../../domain/errors/index.js";
import { requireManagedApartment } from "./apartmentAccess.js";
import {
  HOUSE_CELL_INDEX_MAX,
  HOUSE_CELL_SPAN_MAX,
  HOUSE_FLOOR_MAX,
} from "../../../core/constants/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * UpdateApartmentLayoutUseCase
 * Раскладка квартиры в сетке «Сосед, привет»: на каком этаже, с какой колонки
 * начинается и сколько ячеек занимает.
 *
 * Право — `house:<номер>:manage` (или `global:admin`), то есть ровно то же, что
 * у правки текста информации и у кнопок на фронте.
 */
export class UpdateApartmentLayoutUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  _integer(value, label, min, max, { nullable = false } = {}) {
    if (value === null && nullable) return null;

    const number = Number(value);

    if (!Number.isInteger(number) || number < min || number > max) {
      throw new ValidationError(`${label} must be an integer from ${min} to ${max}`);
    }

    return number;
  }

  /**
   * @param {number} houseId
   * @param {{floor?: number, cellIndex?: number|null, cellSpan?: number}} layout
   * @param {object} user
   */
  async execute(houseId, layout = {}, user) {
    const { floor, cellIndex, cellSpan } = layout;

    if (floor === undefined && cellIndex === undefined && cellSpan === undefined) {
      throw new ValidationError("Нужно указать хотя бы один параметр раскладки");
    }

    const changes = {};

    if (floor !== undefined) {
      changes.floor = this._integer(floor, "Floor", 1, HOUSE_FLOOR_MAX);
    }

    if (cellIndex !== undefined) {
      // null — вернуть квартиру в автоматическую расстановку по номеру.
      changes.cellIndex = this._integer(cellIndex, "Cell index", 0, HOUSE_CELL_INDEX_MAX, {
        nullable: true,
      });
    }

    if (cellSpan !== undefined) {
      changes.cellSpan = this._integer(cellSpan, "Cell span", 1, HOUSE_CELL_SPAN_MAX);
    }

    const house = await requireManagedApartment(this.houseRepository, houseId, user);

    const updated = await this.houseRepository.updateLayout(houseId, changes);

    logger.info("Apartment layout updated", {
      houseId,
      house: house.house,
      apartment: house.number,
      userId: user.user_id,
      fields: Object.keys(changes),
    });

    return updated;
  }
}

export default UpdateApartmentLayoutUseCase;
