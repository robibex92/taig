import BookingRepository from "../../../infrastructure/repositories/BookingRepository.js";
import AdRepository from "../../../infrastructure/repositories/AdRepository.js";
import UserRepository from "../../../infrastructure/repositories/UserRepository.js";
import TelegramService from "../../services/TelegramService.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * CreateBookingUseCase - handles creating a new booking for an ad
 */
export class CreateBookingUseCase {
  constructor(
    bookingRepository = BookingRepository,
    adRepository = AdRepository,
    userRepository = UserRepository
  ) {
    this.bookingRepository = bookingRepository;
    this.adRepository = adRepository;
    this.userRepository = userRepository;
  }

  async execute({ adId, userId }) {
    try {
      // Validate input
      if (!adId || !userId) {
        throw new ValidationError("Ad ID and User ID are required");
      }

      // Check if ad exists and is active
      const ad = await this.adRepository.findById(adId);
      if (!ad) {
        throw new NotFoundError("Ad not found");
      }

      if (ad.status !== "active") {
        throw new ValidationError("Ad is not active");
      }

      // Check if user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Prevent booking own ad
      if (ad.user_id?.toString() === userId.toString()) {
        throw new ForbiddenError("Cannot book your own ad");
      }

      // Check if user already has an active booking
      const existingBooking = await this.bookingRepository.findByUserAndAd(
        userId,
        adId,
        "active"
      );

      if (existingBooking) {
        throw new ValidationError(
          `You already booked this ad (${existingBooking.getOrderText()})`
        );
      }

      // Get current active bookings count to determine order
      const activeCount = await this.bookingRepository.countActiveBookings(
        adId
      );
      const bookingOrder = activeCount + 1;

      // Create booking
      const booking = await this.bookingRepository.create({
        ad_id: adId,
        user_id: userId,
        booking_order: bookingOrder,
        status: "active",
      });

      // Send Telegram notification to seller (non-blocking)
      const telegramService = new TelegramService();
      telegramService.queueTask(async () => {
        try {
          const seller = await this.userRepository.findById(ad.user_id);
          if (seller && seller.user_id) {
            await telegramService.sendBookingNotification({
              sellerTelegramId: seller.user_id.toString(),
              buyerName: user.first_name || user.username || "Не указано",
              buyerUsername: user.username || null,
              adTitle: ad.title,
              adPrice: ad.price,
              bookingOrder,
              adId: ad.id.toString(),
            });
          }
        } catch (err) {
          logger.error("Failed to send booking Telegram notification", {
            error: err.message,
          });
        }
      });

      logger.info("Booking created successfully", {
        bookingId: booking.id,
        adId,
        userId,
        bookingOrder,
      });

      return {
        booking,
        message: `Вы забронировали объявление ${booking.getOrderText()}!`,
      };
    } catch (error) {
      logger.error("Error in CreateBookingUseCase", { error: error.message });
      throw error;
    }
  }
}

export default new CreateBookingUseCase();
