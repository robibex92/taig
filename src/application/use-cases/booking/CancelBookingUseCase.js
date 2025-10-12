const {
  NotFoundError,
  ValidationError,
} = require("../../../core/errors/AppError");

/**
 * Cancel Booking Use Case
 * Allows user to cancel their own booking
 */
class CancelBookingUseCase {
  constructor({ bookingRepository }) {
    this.bookingRepository = bookingRepository;
  }

  async execute({ booking_id, user_id }) {
    // Get booking
    const booking = await this.bookingRepository.findById(booking_id);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    // Check if user owns the booking
    if (booking.user_id !== user_id) {
      throw new ValidationError(
        "Unauthorized: You can only cancel your own bookings"
      );
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      throw new ValidationError(
        "Booking cannot be cancelled in its current state"
      );
    }

    // Update status to cancelled
    const cancelledBooking = await this.bookingRepository.updateStatus(
      booking_id,
      "cancelled"
    );

    return cancelledBooking;
  }
}

module.exports = CancelBookingUseCase;
