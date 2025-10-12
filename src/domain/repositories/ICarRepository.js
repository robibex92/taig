/**
 * Car Repository Interface
 * Defines the contract for car data access
 */
export class ICarRepository {
  /**
   * Get all active cars
   * @returns {Promise<Car[]>}
   */
  async findAll() {
    throw new Error("Method 'findAll()' must be implemented");
  }

  /**
   * Find cars by user ID
   * @param {number} userId
   * @returns {Promise<Car[]>}
   */
  async findByUserId(userId) {
    throw new Error("Method 'findByUserId()' must be implemented");
  }

  /**
   * Find car by ID
   * @param {number} id
   * @returns {Promise<Car|null>}
   */
  async findById(id) {
    throw new Error("Method 'findById()' must be implemented");
  }

  /**
   * Create new car
   * @param {Object} carData
   * @returns {Promise<Car>}
   */
  async create(carData) {
    throw new Error("Method 'create()' must be implemented");
  }

  /**
   * Soft delete car (set status to false)
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async softDelete(id) {
    throw new Error("Method 'softDelete()' must be implemented");
  }
}
