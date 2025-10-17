/**
 * CarImage Repository Interface
 * Defines the contract for car image data access
 */
export class ICarImageRepository {
  /**
   * Get all images for a specific car
   * @param {number} carId - Car ID
   * @returns {Promise<CarImage[]>}
   */
  async getByCarId(carId) {
    throw new Error("Method not implemented");
  }

  /**
   * Get image by ID
   * @param {number} id - Image ID
   * @returns {Promise<CarImage|null>}
   */
  async getById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Create new car image
   * @param {Object} imageData - Image data
   * @returns {Promise<CarImage>}
   */
  async create(imageData) {
    throw new Error("Method not implemented");
  }

  /**
   * Update car image
   * @param {number} id - Image ID
   * @param {Object} updateData - Update data
   * @returns {Promise<CarImage>}
   */
  async update(id, updateData) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete car image
   * @param {number} id - Image ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Get images with pagination
   * @param {number} carId - Car ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<{images: CarImage[], total: number}>}
   */
  async getByCarIdWithPagination(carId, pagination = {}) {
    throw new Error("Method not implemented");
  }
}
