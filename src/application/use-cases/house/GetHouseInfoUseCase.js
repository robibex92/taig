import { NotFoundError } from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Use case for getting house info
 */
export class GetHouseInfoUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(houseId) {
    try {
      const house = await this.houseRepository.findById(houseId);

      if (!house) {
        logger.warn("House not found when getting info", { houseId });
        throw new NotFoundError("House not found");
      }

      return house.info || "";
    } catch (error) {
      logger.error("Error in GetHouseInfoUseCase", {
        houseId,
        error: error.message,
      });
      throw error;
    }
  }
}
