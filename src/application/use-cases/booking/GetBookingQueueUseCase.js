/**
 * Get Booking Queue Use Case
 * Retrieves the booking queue for an ad (ordered by priority)
 */
class GetBookingQueueUseCase {
  constructor({ bookingRepository }) {
    this.bookingRepository = bookingRepository;
  }

  async execute({ ad_id }) {
    const queue = await this.bookingRepository.getQueueByAdId(ad_id);

    // Add position information
    return queue.map((booking, index) => ({
      ...booking,
      position: index + 1,
    }));
  }
}

module.exports = GetBookingQueueUseCase;
