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
import { prisma } from "../../../infrastructure/database/prisma.js";

/**
 * CreateBookingUseCase - handles creating a new booking for an ad
 * 
 * Security improvements:
 * - Uses database transaction to prevent race conditions
 * - Database-level constraint ensures no duplicate bookings (@@unique in schema)
 * - Atomic booking order calculation
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

      // Use transaction to prevent race conditions
      // This ensures that booking check and creation happen atomically
      const booking = await prisma.$transaction(async (tx) => {
        // Check if user already has an active booking (within transaction)
        const existingBooking = await tx.booking.findFirst({
          where: {
            ad_id: BigInt(adId),
            user_id: BigInt(userId),
            status: "active"
          }
        });

        if (existingBooking) {
          throw new ValidationError(
            `You already booked this ad (order #${existingBooking.booking_order})`
          );
        }

        // Get current active bookings count to determine order (within transaction)
        // This ensures accurate count even with concurrent requests
        const activeCount = await tx.booking.count({
          where: {
            ad_id: BigInt(adId),
            status: "active"
          }
        });
        
        const bookingOrder = activeCount + 1;

        // Create booking (within transaction)
        // Database constraint @@unique([ad_id, user_id, status]) provides additional safety
        const newBooking = await tx.booking.create({
          data: {
            ad_id: BigInt(adId),
            user_id: BigInt(userId),
            booking_order: bookingOrder,
            status: "active",
          }
        });

        return newBooking;
      }, {
        // Set transaction isolation level to prevent race conditions
        isolationLevel: 'Serializable',
        // Retry on conflict
        maxWait: 5000, // Wait up to 5 seconds for transaction to start
        timeout: 10000, // Transaction timeout 10 seconds
      });

      // Convert Prisma booking to entity
      const bookingEntity = this.bookingRepository._toEntity(booking);

      // Send Telegram notification to seller (non-blocking)
      const telegramService = new TelegramService(this.adRepository);
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
              bookingOrder: Number(booking.booking_order),
              adId: ad.id.toString(),
            });
          }

          // Update booking count in all Telegram messages for this ad
          await telegramService.updateAdBookingCount({
            adId,
            activeBookings: Number(booking.booking_order), // New total count after this booking
          });
        } catch (err) {
          logger.error("Failed to send booking Telegram notification", {
            error: err.message,
          });
        }
      });

      logger.info("Booking created successfully", {
        bookingId: bookingEntity.id,
        adId,
        userId,
        bookingOrder: Number(booking.booking_order),
      });

      return {
        booking: bookingEntity,
        message: `Вы забронировали объявление ${bookingEntity.getOrderText()}!`,
      };
    } catch (error) {
      // Handle Prisma unique constraint violations
      if (error.code === 'P2002') {
        logger.warn("Duplicate booking attempt detected", { 
          adId, 
          userId,
          error: error.message 
        });
        throw new ValidationError("You already booked this ad");
      }
      
      logger.error("Error in CreateBookingUseCase", { error: error.message });
      throw error;
    }
  }
}

export default new CreateBookingUseCase();
