/**
 * FloorRule Repository Interface
 * Defines the contract for floor rule data access
 */
export class IFloorRuleRepository {
  /**
   * Get floor rules by house and entrance
   * @param {string} house
   * @param {number} entrance
   * @returns {Promise<FloorRule[]>}
   */
  async findByHouseAndEntrance(house, entrance) {
    throw new Error("Method 'findByHouseAndEntrance()' must be implemented");
  }

  /**
   * Create or update the rule of one floor.
   *
   * Реализация делает это одним `prisma.floorRule.upsert`; отдельных
   * `findByHouseEntranceFloor`/`create`/`update` в контракте больше нет — их
   * вызывал `UpsertFloorRuleUseCase`, у репозитория таких методов не существует,
   * и любой POST /floor-rules падал с TypeError.
   */
  async upsert(ruleData) {
    throw new Error("Method 'upsert()' must be implemented");
  }
}
