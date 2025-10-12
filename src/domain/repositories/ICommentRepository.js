/**
 * Comment Repository Interface
 * Defines the contract for comment data access
 */
class ICommentRepository {
  /**
   * Create a new comment
   * @param {Object} commentData
   * @returns {Promise<Comment>}
   */
  async create(commentData) {
    throw new Error("Method not implemented");
  }

  /**
   * Find comment by ID
   * @param {number} id
   * @returns {Promise<Comment|null>}
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all comments for an ad (with replies)
   * @param {number} adId
   * @param {Object} options
   * @returns {Promise<Comment[]>}
   */
  async findByAdId(adId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all comments by user
   * @param {number} userId
   * @param {Object} options
   * @returns {Promise<Comment[]>}
   */
  async findByUserId(userId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Find replies to a comment
   * @param {number} parentId
   * @returns {Promise<Comment[]>}
   */
  async findReplies(parentId) {
    throw new Error("Method not implemented");
  }

  /**
   * Update comment content
   * @param {number} id
   * @param {string} content
   * @returns {Promise<Comment>}
   */
  async update(id, content) {
    throw new Error("Method not implemented");
  }

  /**
   * Soft delete comment
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async softDelete(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Hard delete comment
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Count comments for an ad
   * @param {number} adId
   * @param {boolean} includeDeleted
   * @returns {Promise<number>}
   */
  async countByAdId(adId, includeDeleted = false) {
    throw new Error("Method not implemented");
  }

  /**
   * Get comment tree (with nested replies)
   * @param {number} adId
   * @returns {Promise<Comment[]>}
   */
  async getCommentTree(adId) {
    throw new Error("Method not implemented");
  }
}

module.exports = ICommentRepository;
