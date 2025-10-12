/**
 * AdImage Repository Interface
 * Defines the contract for ad image data access
 */
export class IAdImageRepository {
  /**
   * Find images by ad ID
   * @param {number} adId
   * @returns {Promise<AdImage[]>}
   */
  async findByAdId(adId) {
    throw new Error("Method 'findByAdId()' must be implemented");
  }

  /**
   * Find images by post ID
   * @param {number} postId
   * @returns {Promise<AdImage[]>}
   */
  async findByPostId(postId) {
    throw new Error("Method 'findByPostId()' must be implemented");
  }

  /**
   * Find image by ID
   * @param {number} id
   * @returns {Promise<AdImage|null>}
   */
  async findById(id) {
    throw new Error("Method 'findById()' must be implemented");
  }

  /**
   * Create multiple images
   * @param {number|null} adId
   * @param {number|null} postId
   * @param {Array} images
   * @param {string} serverUrl
   * @returns {Promise<AdImage[]>}
   */
  async createMultiple(adId, postId, images, serverUrl) {
    throw new Error("Method 'createMultiple()' must be implemented");
  }

  /**
   * Delete image by ID
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    throw new Error("Method 'deleteById()' must be implemented");
  }

  /**
   * Delete multiple images
   * @param {Array<number>} ids
   * @returns {Promise<number>}
   */
  async deleteMultiple(ids) {
    throw new Error("Method 'deleteMultiple()' must be implemented");
  }

  /**
   * Set main image
   * @param {number} imageId
   * @param {number|null} adId
   * @param {number|null} postId
   * @returns {Promise<boolean>}
   */
  async setMainImage(imageId, adId, postId) {
    throw new Error("Method 'setMainImage()' must be implemented");
  }

  /**
   * Unset main flag for all images of ad/post
   * @param {number|null} adId
   * @param {number|null} postId
   * @returns {Promise<void>}
   */
  async unsetMainForAll(adId, postId) {
    throw new Error("Method 'unsetMainForAll()' must be implemented");
  }
}
