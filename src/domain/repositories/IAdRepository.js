/**
 * Ad Repository Interface
 * Defines the contract for ad data access
 */
export class IAdRepository {
  /**
   * Find ad by ID
   * @param {number} id - Ad ID
   * @returns {Promise<AdEntity|null>}
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all ads with filters and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<{ads: AdEntity[], total: number}>}
   */
  async findAll(filters = {}, pagination = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Find ads by user ID
   * @param {number} userId - User ID
   * @param {Object} filters - Filter criteria
   * @returns {Promise<AdEntity[]>}
   */
  async findByUserId(userId, filters = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Create a new ad
   * @param {AdEntity} ad - Ad entity
   * @returns {Promise<AdEntity>}
   */
  async create(ad) {
    throw new Error("Method not implemented");
  }

  /**
   * Update an ad
   * @param {number} id - Ad ID
   * @param {Object} data - Update data
   * @returns {Promise<AdEntity>}
   */
  async update(id, data) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete an ad
   * @param {number} id - Ad ID
   * @param {boolean} soft - Soft delete flag
   * @returns {Promise<boolean>}
   */
  async delete(id, soft = true) {
    throw new Error("Method not implemented");
  }

  /**
   * Increment view count
   * @param {number} id - Ad ID
   * @returns {Promise<number>}
   */
  async incrementViewCount(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Archive old ads
   * @param {number} hours - Number of hours
   * @returns {Promise<AdEntity[]>}
   */
  async archiveOldAds(hours) {
    throw new Error("Method not implemented");
  }
}
