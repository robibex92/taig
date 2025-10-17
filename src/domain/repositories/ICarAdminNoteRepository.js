/**
 * CarAdminNote Repository Interface
 * Defines the contract for car admin note data access
 */
export class ICarAdminNoteRepository {
  /**
   * Get all admin notes for a specific car
   * @param {number} carId - Car ID
   * @returns {Promise<CarAdminNote[]>}
   */
  async getByCarId(carId) {
    throw new Error("Method not implemented");
  }

  /**
   * Get admin note by ID
   * @param {number} id - Note ID
   * @returns {Promise<CarAdminNote|null>}
   */
  async getById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Create new admin note
   * @param {Object} noteData - Note data
   * @returns {Promise<CarAdminNote>}
   */
  async create(noteData) {
    throw new Error("Method not implemented");
  }

  /**
   * Update admin note
   * @param {number} id - Note ID
   * @param {Object} updateData - Update data
   * @returns {Promise<CarAdminNote>}
   */
  async update(id, updateData) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete admin note
   * @param {number} id - Note ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete all admin notes for a car (when car gets assigned to user)
   * @param {number} carId - Car ID
   * @returns {Promise<boolean>}
   */
  async deleteByCarId(carId) {
    throw new Error("Method not implemented");
  }
}
