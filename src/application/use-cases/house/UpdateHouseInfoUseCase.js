import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../../../domain/errors/index.js";
import { requireManagedApartment } from "./apartmentAccess.js";
import { HOUSE_INFO_MAX_LENGTH } from "../../../core/constants/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * UpdateHouseInfoUseCase
 * Текст информации о квартире в реестре «Сосед, привет».
 * Раскладка (этаж, колонка, ширина) — отдельный кейс `UpdateApartmentLayoutUseCase`.
 */
export class UpdateHouseInfoUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  /**
   * @param {number} houseId - House ID
   * @param {string} info — новый текст (пустая строка очищает информацию)
   * @param {object} user - Current user
   */
  async execute(houseId, info, user) {
    if (info === undefined || info === null) {
      throw new ValidationError("Info field is required");
    }

    const trimmedInfo = String(info).trim();

    if (trimmedInfo.length > HOUSE_INFO_MAX_LENGTH) {
      throw new ValidationError(
        `Info text cannot exceed ${HOUSE_INFO_MAX_LENGTH} characters`
      );
    }

    let house;

    try {
      house = await requireManagedApartment(this.houseRepository, houseId, user);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        logger.warn("Unauthorized attempt to update house info", {
          userId: user?.user_id,
          houseId,
        });
      }

      throw error;
    }

    const updatedHouse = await this.houseRepository.updateInfo(houseId, trimmedInfo);

    logger.info("House info updated", {
      houseId,
      house: house.house,
      userId: user.user_id,
      infoLength: trimmedInfo.length,
    });

    return updatedHouse;
  }
}

export default UpdateHouseInfoUseCase;
