/**
 * Entrance Comment Repository Interface
 * Defines methods for managing entrance comments
 */
export class IEntranceCommentRepository {
  /**
   * Create a new entrance comment
   * @param {Object} commentData - Comment data
   * @param {BigInt} commentData.house_id - House ID
   * @param {number} commentData.entrance - Entrance number
   * @param {BigInt} commentData.author_id - Author ID
   * @param {string} commentData.comment - Comment text
   * @returns {Promise<Object>} Created comment
   */
  async create(commentData) {
    throw new Error("Method 'create()' must be implemented");
  }

  /**
   * Get comment by ID
   * @param {BigInt} id - Comment ID
   * @returns {Promise<Object|null>} Comment or null
   */
  async findById(id) {
    throw new Error("Method 'findById()' must be implemented");
  }

  /**
   * Get comments for a specific house entrance
   * @param {BigInt} house_id - House ID
   * @param {number} entrance - Entrance number
   * @returns {Promise<Object|null>} Comment or null (only one per entrance)
   */
  async findByHouseAndEntrance(house_id, entrance) {
    throw new Error("Method 'findByHouseAndEntrance()' must be implemented");
  }

  /**
   * Get all comments for a house
   * @param {BigInt} house_id - House ID
   * @returns {Promise<Array>} Comments array
   */
  async findByHouseId(house_id) {
    throw new Error("Method 'findByHouseId()' must be implemented");
  }

  /**
   * Update a comment
   * @param {BigInt} id - Comment ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated comment
   */
  async update(id, updateData) {
    throw new Error("Method 'update()' must be implemented");
  }

  /**
   * Delete a comment
   * @param {BigInt} id - Comment ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    throw new Error("Method 'delete()' must be implemented");
  }

  /**
   * Check if user is comment author or admin
   * @param {BigInt} commentId - Comment ID
   * @param {BigInt} userId - User ID
   * @returns {Promise<boolean>} Can manage
   */
  async canUserManage(commentId, userId) {
    throw new Error("Method 'canUserManage()' must be implemented");
  }
}
