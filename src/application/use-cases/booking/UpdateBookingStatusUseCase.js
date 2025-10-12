const {
  NotFoundError,
  ValidationError,
} = require("../../../core/errors/AppError");

/**
 * Update Booking Status Use Case
 * Allows seller to confirm/reject bookings
 */
class UpdateBookingStatusUseCase {
  constructor({ bookingRepository, adRepository, telegramService }) {
    this.bookingRepository = bookingRepository;
    this.adRepository = adRepository;
    this.telegramService = telegramService;
  }

  async execute({ booking_id, seller_id, status, seller_note = null }) {
    // Validate status
    if (!["confirmed", "rejected"].includes(status)) {
      throw new ValidationError("Status must be confirmed or rejected");
    }

    // Get booking
    const booking = await this.bookingRepository.findById(booking_id);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    // Check if user is the seller
    const ad = await this.adRepository.findById(booking.ad_id);
    if (!ad || ad.user_id !== seller_id) {
      throw new ValidationError(
        "Unauthorized: Only the seller can update booking status"
      );
    }

    // Check if booking can be confirmed
    if (!booking.canBeConfirmed()) {
      throw new ValidationError(
        "Booking cannot be confirmed in its current state"
      );
    }

    // Update status
    const updatedBooking = await this.bookingRepository.updateStatus(
      booking_id,
      status,
      seller_note
    );

    // Notify buyer via Telegram
    try {
      await this.telegramService.notifyBuyerAboutStatus(
        booking.user_id,
        updatedBooking,
        status
      );
    } catch (error) {
      console.error("Failed to notify buyer:", error);
    }

    return updatedBooking;
  }
}

module.exports = UpdateBookingStatusUseCase;
