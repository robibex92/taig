import BookingRepository from "../../../infrastructure/repositories/BookingRepository.js";
import AdRepository from "../../../infrastructure/repositories/AdRepository.js";
import {
  ValidationError,
  NotFoundError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * GetBookingsUseCase - retrieves bookings for an ad or user
 */
export class GetBookingsUseCase {
  constructor(
    bookingRepository = BookingRepository,
    adRepository = AdRepository
  ) {
    this.bookingRepository = bookingRepository;
    this.adRepository = adRepository;
  }

  /**
   * Get bookings for a specific ad
   */
  async getAdBookings({ adId, status = "active" }) {
    try {
      // Validate input
      if (!adId) {
        throw new ValidationError("Ad ID is required");
      }

      // Check if ad exists
      const ad = await this.adRepository.findById(adId);
      if (!ad) {
        throw new NotFoundError("Ad not found");
      }

      // Get bookings
      const bookings =
        status === "all"
          ? await this.bookingRepository.findAllBookingsByAd(adId)
          : await this.bookingRepository.findActiveBookingsByAd(adId);

      logger.info("Ad bookings retrieved successfully", {
        adId,
        status,
        count: bookings.length,
      });

      return {
        bookings: bookings.map((b) => b.toJSON()),
        total: bookings.length,
      };
    } catch (error) {
      logger.error("Error in GetBookingsUseCase (getAdBookings)", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get bookings for a specific user
   */
  async getUserBookings({ userId, status = null }) {
    try {
      // Validate input
      if (!userId) {
        throw new ValidationError("User ID is required");
      }

      // Get user's bookings
      const bookings = await this.bookingRepository.findUserBookings(
        userId,
        status
      );

      logger.info("User bookings retrieved successfully", {
        userId,
        status,
        count: bookings.length,
      });

      return {
        bookings: bookings.map((b) => b.toJSON()),
        total: bookings.length,
      };
    } catch (error) {
      logger.error("Error in GetBookingsUseCase (getUserBookings)", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get booking statistics for an ad
   */
  async getAdBookingStats({ adId }) {
    try {
      // Validate input
      if (!adId) {
        throw new ValidationError("Ad ID is required");
      }

      // Check if ad exists
      const ad = await this.adRepository.findById(adId);
      if (!ad) {
        throw new NotFoundError("Ad not found");
      }

      // Get statistics
      const stats = await this.bookingRepository.getAdBookingStats(adId);

      logger.info("Ad booking stats retrieved successfully", {
        adId,
        activeCount: stats.activeCount,
        totalCount: stats.totalCount,
      });

      // Safely convert bookings to JSON
      const bookingsJSON =
        stats.bookings && Array.isArray(stats.bookings)
          ? stats.bookings.map((b) => {
              try {
                return b.toJSON ? b.toJSON() : b;
              } catch (e) {
                logger.error("Error converting booking to JSON", {
                  error: e.message,
                  booking: b,
                });
                return b;
              }
            })
          : [];

      return {
        activeCount: stats.activeCount || 0,
        totalCount: stats.totalCount || 0,
        cancelledCount: stats.cancelledCount || 0,
        bookings: bookingsJSON,
      };
    } catch (error) {
      logger.error("Error in GetBookingsUseCase (getAdBookingStats)", {
        error: error.message,
        stack: error.stack,
        adId,
      });
      throw error;
    }
  }

  /**
   * Check if user has booked an ad
   */
  async checkUserBooking({ userId, adId }) {
    try {
      // Validate input
      if (!userId || !adId) {
        throw new ValidationError("User ID and Ad ID are required");
      }

      // Check for active booking
      const hasBooking = await this.bookingRepository.hasActiveBooking(
        userId,
        adId
      );
      const booking = hasBooking
        ? await this.bookingRepository.findByUserAndAd(userId, adId, "active")
        : null;

      logger.info("User booking check completed", {
        userId,
        adId,
        hasBooking,
      });

      return {
        hasBooking,
        booking: booking ? booking.toJSON() : null,
      };
    } catch (error) {
      logger.error("Error in GetBookingsUseCase (checkUserBooking)", {
        error: error.message,
      });
      throw error;
    }
  }
}

export default new GetBookingsUseCase();
