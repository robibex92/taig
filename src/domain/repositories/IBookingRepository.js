/**
 * Booking Repository Interface
 * Defines the contract for booking data access
 */
class IBookingRepository {
  /**
   * Create a new booking
   * @param {Object} bookingData
   * @returns {Promise<Booking>}
   */
  async create(bookingData) {
    throw new Error("Method not implemented");
  }

  /**
   * Find booking by ID
   * @param {number} id
   * @returns {Promise<Booking|null>}
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all bookings for an ad
   * @param {number} adId
   * @param {Object} options - { status, orderBy }
   * @returns {Promise<Booking[]>}
   */
  async findByAdId(adId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Find all bookings for a user
   * @param {number} userId
   * @param {Object} options
   * @returns {Promise<Booking[]>}
   */
  async findByUserId(userId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Find booking by ad and user
   * @param {number} adId
   * @param {number} userId
   * @returns {Promise<Booking|null>}
   */
  async findByAdAndUser(adId, userId) {
    throw new Error("Method not implemented");
  }

  /**
   * Update booking
   * @param {number} id
   * @param {Object} updateData
   * @returns {Promise<Booking>}
   */
  async update(id, updateData) {
    throw new Error("Method not implemented");
  }

  /**
   * Update booking status
   * @param {number} id
   * @param {string} status
   * @param {string} sellerNote
   * @returns {Promise<Booking>}
   */
  async updateStatus(id, status, sellerNote = null) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete booking
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Get booking queue for an ad (ordered by priority and created_at)
   * @param {number} adId
   * @returns {Promise<Booking[]>}
   */
  async getQueueByAdId(adId) {
    throw new Error("Method not implemented");
  }

  /**
   * Count active bookings for an ad
   * @param {number} adId
   * @returns {Promise<number>}
   */
  async countActiveByAdId(adId) {
    throw new Error("Method not implemented");
  }
}

module.exports = IBookingRepository;
