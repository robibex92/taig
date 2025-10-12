/**
 * Use case for getting floor rules
 */
export class GetFloorRulesUseCase {
  constructor(floorRuleRepository) {
    this.floorRuleRepository = floorRuleRepository;
  }

  async execute(house, entrance) {
    return await this.floorRuleRepository.findByHouseAndEntrance(
      house,
      entrance
    );
  }
}
