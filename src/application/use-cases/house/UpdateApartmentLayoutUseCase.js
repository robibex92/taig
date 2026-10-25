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

/** Фасадный цвет хранится шестью HEX-символами: фронт сам дописывает альфа-канал пустой ячейке. */
const FACADE_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * UpdateApartmentLayoutUseCase
 * Раскладка квартиры в сетке «Сосед, привет»: на каком этаже, с какой колонки
 * начинается, сколько ячеек занимает и каким цветом залита клетка.
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
   * Цвет фасадной ячейки: `null` — сбросить на цвет по умолчанию (белый в светлой
   * теме, тёмный в тёмной), иначе `#rrggbb` без альфа-канала.
   */
  _facadeColor(value, label) {
    if (value === null) return null;

    if (typeof value !== "string" || !FACADE_COLOR_RE.test(value)) {
      throw new ValidationError(`${label} must be a hex color like #A1B2C3`);
    }

    return value.toUpperCase();
  }

  /**
   * @param {number} houseId
   * @param {{floor?: number, cellIndex?: number|null, cellSpan?: number, facadeColor?: string|null}} layout
   * @param {object} user
   */
  async execute(houseId, layout = {}, user) {
    const { floor, cellIndex, cellSpan, facadeColor } = layout;

    if (
      floor === undefined &&
      cellIndex === undefined &&
      cellSpan === undefined &&
      facadeColor === undefined
    ) {
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

    if (facadeColor !== undefined) {
      changes.facadeColor = this._facadeColor(facadeColor, "Facade color");
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
