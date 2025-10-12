import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for creating or updating a floor rule (upsert)
 */
export class UpsertFloorRuleUseCase {
  constructor(floorRuleRepository) {
    this.floorRuleRepository = floorRuleRepository;
  }

  async execute(ruleData) {
    const { house, entrance, floor, position } = ruleData;

    // Check if rule already exists
    const existing = await this.floorRuleRepository.findByHouseEntranceFloor(
      house,
      entrance,
      floor
    );

    let result;

    if (existing) {
      // Update existing rule
      result = await this.floorRuleRepository.update(
        house,
        entrance,
        floor,
        position
      );
      logger.info("Floor rule updated", { house, entrance, floor, position });
    } else {
      // Create new rule
      result = await this.floorRuleRepository.create(ruleData);
      logger.info("Floor rule created", { house, entrance, floor, position });
    }

    return result;
  }
}
