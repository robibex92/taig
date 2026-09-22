import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../../../domain/errors/index.js";
import { canManageHouse } from "../../../core/utils/roles.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * UpdateHouseInfoUseCase
 * Updates the info field for a specific apartment/house
 * Allowed for administrators and holders of the `house:<n>:manage` role
 */
export class UpdateHouseInfoUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  /**
   * Execute use case
   * @param {number} houseId - House ID
   * @param {string} info - New info text
   * @param {object} user - Current user
   * @returns {Promise<object>} Updated house
   */
  async execute(houseId, info, user) {
    // Validate info content
    if (info === undefined || info === null) {
      throw new ValidationError("Info field is required");
    }

    // Trim and validate length
    const trimmedInfo = String(info).trim();
    if (trimmedInfo.length > 5000) {
      throw new ValidationError("Info text cannot exceed 5000 characters");
    }

    // Check if house exists
    const house = await this.houseRepository.findById(houseId);
    if (!house) {
      throw new NotFoundError("House not found");
    }

    // Check permission for this building
    if (!canManageHouse(user, house.house)) {
      logger.warn("Unauthorized attempt to update house info", {
        userId: user?.user_id,
        houseId,
        house: house.house,
      });
      throw new ForbiddenError(
        "Only administrators and building managers can update house information"
      );
    }

    // Update house info
    const updatedHouse = await this.houseRepository.updateInfo(
      houseId,
      trimmedInfo
    );

    logger.info("House info updated", {
      houseId,
      userId: user.user_id,
      infoLength: trimmedInfo.length,
    });

    return updatedHouse;
  }
}

export default UpdateHouseInfoUseCase;
