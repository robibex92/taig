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
 * CancelBookingUseCase - handles cancelling a booking
 */
export class CancelBookingUseCase {
  constructor(
    bookingRepository = BookingRepository,
    adRepository = AdRepository,
    userRepository = UserRepository
  ) {
    this.bookingRepository = bookingRepository;
    this.adRepository = adRepository;
    this.userRepository = userRepository;
  }

  async execute({ bookingId, userId }) {
    try {
      // Validate input
      if (!bookingId || !userId) {
        throw new ValidationError("Booking ID and User ID are required");
      }

      // Find booking
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError("Booking not found");
      }

      // Check if booking belongs to user
      if (booking.user_id?.toString() !== userId.toString()) {
        throw new ForbiddenError("This booking does not belong to you");
      }

      // Check if booking is already cancelled
      if (booking.status === "cancelled") {
        throw new ValidationError("Booking is already cancelled");
      }

      // Cancel booking
      const cancelledBooking = await this.bookingRepository.cancel(bookingId);

      // Send Telegram notification to seller (non-blocking)
      const telegramService = new TelegramService();
      telegramService.queueTask(async () => {
        try {
          const ad = await this.adRepository.findById(booking.ad_id);
          const user = await this.userRepository.findById(userId);

          if (ad && user) {
            const seller = await this.userRepository.findById(ad.user_id);
            if (seller && seller.user_id) {
              await telegramService.sendBookingCancellationNotification({
                sellerTelegramId: seller.user_id.toString(),
                buyerName: user.first_name || user.username || "Не указано",
                buyerUsername: user.username || null,
                adTitle: ad.title,
                bookingOrder: booking.booking_order,
                adId: ad.id.toString(),
              });
            }
          }
        } catch (err) {
          logger.error(
            "Failed to send booking cancellation Telegram notification",
            {
              error: err.message,
            }
          );
        }
      });

      logger.info("Booking cancelled successfully", {
        bookingId,
        userId,
        adId: booking.ad_id,
      });

      return {
        booking: cancelledBooking,
        message: "Бронь отменена",
      };
    } catch (error) {
      logger.error("Error in CancelBookingUseCase", { error: error.message });
      throw error;
    }
  }
}

export default new CancelBookingUseCase();
