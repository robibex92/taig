/**
 * User Repository Interface
 * Defines the contract for user data access
 */
export class IUserRepository {
  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<UserEntity|null>}
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Find user by Telegram ID
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<UserEntity|null>}
   */
  async findByTelegramId(telegramId) {
    throw new Error("Method not implemented");
  }

  /**
   * Create a new user
   * @param {UserEntity} user - User entity
   * @returns {Promise<UserEntity>}
   */
  async create(user) {
    throw new Error("Method not implemented");
  }

  /**
   * Update a user
   * @param {number} id - User ID
   * @param {Object} data - Update data
   * @returns {Promise<UserEntity>}
   */
  async update(id, data) {
    throw new Error("Method not implemented");
  }

  /**
   * Save refresh token
   * @param {number} userId - User ID
   * @param {string} token - Refresh token
   * @returns {Promise<void>}
   */
  async saveRefreshToken(userId, token) {
    throw new Error("Method not implemented");
  }

  /**
   * Get refresh token
   * @param {number} userId - User ID
   * @returns {Promise<string|null>}
   */
  async getRefreshToken(userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Clear refresh token
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async clearRefreshToken(userId) {
    throw new Error("Method not implemented");
  }
}
