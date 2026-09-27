import { ValidationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for creating or updating a floor rule (upsert)
 */
export class UpsertFloorRuleUseCase {
  constructor(floorRuleRepository) {
    this.floorRuleRepository = floorRuleRepository;
  }

  async execute(ruleData) {
    const { house, entrance, floor, position } = ruleData ?? {};

    if (!house || !Number.isInteger(entrance) || !Number.isInteger(floor)) {
      throw new ValidationError("house, entrance and floor are required");
    }

    // `position` — это номер ячейки, с которой начинается ряд (1 = без сдвига).
    if (!Number.isInteger(position) || position < 1) {
      throw new ValidationError("position must be a positive integer");
    }

    const result = await this.floorRuleRepository.upsert({
      house,
      entrance,
      floor,
      position,
    });

    logger.info("Floor rule upserted", { house, entrance, floor, position });

    return result;
  }
}
