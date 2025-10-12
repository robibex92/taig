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
   * Find existing rule
   * @param {string} house
   * @param {number} entrance
   * @param {number} floor
   * @returns {Promise<FloorRule|null>}
   */
  async findByHouseEntranceFloor(house, entrance, floor) {
    throw new Error("Method 'findByHouseEntranceFloor()' must be implemented");
  }

  /**
   * Create new floor rule
   * @param {Object} ruleData
   * @returns {Promise<FloorRule>}
   */
  async create(ruleData) {
    throw new Error("Method 'create()' must be implemented");
  }

  /**
   * Update floor rule
   * @param {string} house
   * @param {number} entrance
   * @param {number} floor
   * @param {number} position
   * @returns {Promise<FloorRule>}
   */
  async update(house, entrance, floor, position) {
    throw new Error("Method 'update()' must be implemented");
  }
}
