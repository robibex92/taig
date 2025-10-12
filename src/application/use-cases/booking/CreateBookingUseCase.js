const Booking = require("../../../domain/entities/Booking.entity");
const {
  NotFoundError,
  ValidationError,
  ConflictError,
} = require("../../../core/errors/AppError");

/**
 * Create Booking Use Case
 * Creates a new booking for an ad
 */
class CreateBookingUseCase {
  constructor({ bookingRepository, adRepository, telegramService }) {
    this.bookingRepository = bookingRepository;
    this.adRepository = adRepository;
    this.telegramService = telegramService;
  }

  async execute({ ad_id, user_id, message = null }) {
    // 1. Validate data
    const validation = Booking.validate({ ad_id, user_id, message });
    if (!validation.isValid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    // 2. Check if ad exists and is active
    const ad = await this.adRepository.findById(ad_id);
    if (!ad || ad.status !== "active") {
      throw new NotFoundError("Ad not found or not active");
    }

    // 3. Check if user is not the seller
    if (ad.user_id === user_id) {
      throw new ValidationError("Cannot book your own ad");
    }

    // 4. Check if user already has a booking for this ad
    const existingBooking = await this.bookingRepository.findByAdAndUser(
      ad_id,
      user_id
    );
    if (existingBooking) {
      throw new ConflictError("You already have a booking for this ad");
    }

    // 5. Get current queue position (lowest priority + 1)
    const queue = await this.bookingRepository.getQueueByAdId(ad_id);
    const priority =
      queue.length > 0 ? Math.max(...queue.map((b) => b.priority)) + 1 : 1;

    // 6. Create booking
    const bookingData = {
      ad_id,
      user_id,
      message,
      priority,
      status: "pending",
    };

    const booking = await this.bookingRepository.create(bookingData);

    // 7. Notify seller via Telegram
    try {
      await this.telegramService.notifySellerAboutBooking(
        ad.user_id,
        booking,
        queue.length + 1
      );
    } catch (error) {
      console.error("Failed to notify seller:", error);
      // Don't fail the booking if notification fails
    }

    return booking;
  }
}

module.exports = CreateBookingUseCase;
