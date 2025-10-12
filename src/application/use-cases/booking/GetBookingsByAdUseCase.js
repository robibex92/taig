/**
 * Get Bookings By Ad Use Case
 * Retrieves all bookings for an ad (seller only)
 */
class GetBookingsByAdUseCase {
  constructor({ bookingRepository, adRepository }) {
    this.bookingRepository = bookingRepository;
    this.adRepository = adRepository;
  }

  async execute({ ad_id, user_id, status = null }) {
    // Check if user is the ad owner
    const ad = await this.adRepository.findById(ad_id);
    if (!ad || ad.user_id !== user_id) {
      throw new Error(
        "Unauthorized: You can only view bookings for your own ads"
      );
    }

    // Get bookings
    const bookings = await this.bookingRepository.findByAdId(ad_id, { status });

    return bookings;
  }
}

module.exports = GetBookingsByAdUseCase;
