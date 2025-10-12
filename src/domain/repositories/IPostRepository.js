/**
 * Post Repository Interface
 * Defines the contract for post data access
 */
export class IPostRepository {
  /**
   * Find post by ID
   * @param {number} id - Post ID
   * @returns {Promise<PostEntity|null>}
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all posts with filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<PostEntity[]>}
   */
  async findAll(filters = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Create a new post
   * @param {PostEntity} post - Post entity
   * @returns {Promise<PostEntity>}
   */
  async create(post) {
    throw new Error("Method not implemented");
  }

  /**
   * Update a post
   * @param {number} id - Post ID
   * @param {Object} data - Update data
   * @returns {Promise<PostEntity>}
   */
  async update(id, data) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete a post (soft delete)
   * @param {number} id - Post ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Get Telegram messages for a post
   * @param {number} postId - Post ID
   * @returns {Promise<Array>}
   */
  async getTelegramMessagesByPostId(postId) {
    throw new Error("Method not implemented");
  }

  /**
   * Save Telegram message for a post
   * @param {number} postId
   * @param {string} chatId
   * @param {string} threadId
   * @param {number} messageId
   * @param {string} caption
   * @param {boolean} isMedia
   * @param {string} mediaGroupId
   * @returns {Promise<Object>}
   */
  async saveTelegramMessage(
    postId,
    chatId,
    threadId,
    messageId,
    caption,
    isMedia,
    mediaGroupId
  ) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete Telegram messages for a post
   * @param {number} postId - Post ID
   * @returns {Promise<boolean>}
   */
  async deleteTelegramMessages(postId) {
    throw new Error("Method not implemented");
  }
}
