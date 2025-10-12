/**
 * FAQ Repository Interface
 * Defines the contract for FAQ data access
 */
export class IFaqRepository {
  /**
   * Get all FAQs with optional status filter
   * @param {string|null} status
   * @returns {Promise<Faq[]>}
   */
  async findAll(status = null) {
    throw new Error("Method 'findAll()' must be implemented");
  }

  /**
   * Find FAQ by ID
   * @param {number} id
   * @returns {Promise<Faq|null>}
   */
  async findById(id) {
    throw new Error("Method 'findById()' must be implemented");
  }

  /**
   * Update FAQ
   * @param {number} id
   * @param {Object} updateData
   * @returns {Promise<Faq>}
   */
  async update(id, updateData) {
    throw new Error("Method 'update()' must be implemented");
  }

  /**
   * Soft delete FAQ (set status to 'deleted')
   * @param {number} id
   * @returns {Promise<Faq>}
   */
  async softDelete(id) {
    throw new Error("Method 'softDelete()' must be implemented");
  }
}
