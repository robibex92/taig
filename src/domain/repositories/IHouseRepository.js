/**
 * House Repository Interface
 * Defines contract for house data access
 */
export class IHouseRepository {
  /**
   * Get all unique houses (distinct)
   * @returns {Promise<string[]>}
   */
  async findUniqueHouses() {
    throw new Error("Method not implemented");
  }

  /**
   * Get all unique entrances for a house
   * @param {string} house
   * @returns {Promise<number[]>}
   */
  async findEntrancesByHouse(house) {
    throw new Error("Method not implemented");
  }

  /**
   * Find houses with filters
   * @param {Object} filters
   * @returns {Promise<House[]>}
   */
  async findByFilters(filters) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all houses by user telegram ID
   * @param {number} telegramId
   * @returns {Promise<House[]>}
   */
  async findByUserId(telegramId) {
    throw new Error("Method not implemented");
  }

  /**
   * Find house by ID
   * @param {number} id
   * @returns {Promise<House|null>}
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Find base record (position=1) by house and number
   * @param {string} house
   * @param {number} number
   * @returns {Promise<House|null>}
   */
  async findBasePosition(house, number) {
    throw new Error("Method not implemented");
  }

  /**
   * Get max position for a specific apartment
   * @param {string} house
   * @param {number} number
   * @returns {Promise<number>}
   */
  async getMaxPosition(house, number) {
    throw new Error("Method not implemented");
  }

  /**
   * Count records with position=1 for apartment
   * @param {string} house
   * @param {number} number
   * @returns {Promise<number>}
   */
  async countPosition1Records(house, number) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all records for a specific apartment ordered by position
   * @param {string} house
   * @param {number} entrance
   * @param {number} number
   * @returns {Promise<House[]>}
   */
  async findAllByApartment(house, entrance, number) {
    throw new Error("Method not implemented");
  }

  /**
   * Update house telegram ID
   * @param {number} id
   * @param {number} telegramId
   * @returns {Promise<House>}
   */
  async updateTelegramId(id, telegramId) {
    throw new Error("Method not implemented");
  }

  /**
   * Set telegram ID to null
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async clearTelegramId(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Create new house record
   * @param {Object} data
   * @returns {Promise<House>}
   */
  async create(data) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete house record
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    throw new Error("Method not implemented");
  }
}
