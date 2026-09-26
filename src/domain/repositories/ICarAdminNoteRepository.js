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
   * Move all admin notes of one car onto another (cars merge)
   * @param {number} fromCarId - Car the notes currently belong to
   * @param {number} toCarId - Car that survives the merge
   * @returns {Promise<boolean>}
   */
  async moveByCarId(fromCarId, toCarId) {
    throw new Error("Method not implemented");
  }
}
