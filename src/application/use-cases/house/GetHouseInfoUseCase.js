import { ForbiddenError, NotFoundError } from "../../../domain/errors/index.js";
import { canViewHouse } from "../../../core/utils/roles.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Use case for getting house info
 *
 * Info is resident data: only global moderators/admins and users holding a
 * `house:<n>:view` (or `:manage`) role for that building may read it.
 */
export class GetHouseInfoUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(houseId, user) {
    const house = await this.houseRepository.findById(houseId);

    if (!house) {
      logger.warn("House not found when getting info", { houseId });
      throw new NotFoundError("House not found");
    }

    if (!canViewHouse(user, house.house)) {
      logger.warn("House info access denied", {
        houseId,
        user_id: user?.user_id,
        house: house.house,
      });
      throw new ForbiddenError("House information is available only to residents' council and administrators");
    }

    return house.info || "";
  }
}
