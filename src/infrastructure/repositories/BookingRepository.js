import { PrismaClient } from "@prisma/client";
import { BookingEntity } from "../../domain/entities/Booking.entity.js";
import { DatabaseError } from "../../domain/errors/index.js";
import logger from "../../infrastructure/logger/index.js";

const prisma = new PrismaClient();

/**
 * BookingRepository - handles all database operations for bookings
 */
export class BookingRepository {
  /**
   * Create a new booking
   */
  async create(bookingData) {
    try {
      const booking = await prisma.booking.create({
        data: {
          ad_id: BigInt(bookingData.ad_id),
          user_id: BigInt(bookingData.user_id),
          booking_order: bookingData.booking_order,
          status: bookingData.status || "active",
        },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              price: true,
              user_id: true,
            },
          },
          user: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
      });

      return BookingEntity.fromDatabase(booking);
    } catch (error) {
      logger.error("Error creating booking", { error: error.message });
      throw new DatabaseError("Failed to create booking", error);
    }
  }

  /**
   * Find booking by ID
   */
  async findById(bookingId) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: BigInt(bookingId) },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              price: true,
              user_id: true,
            },
          },
          user: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
      });

      return booking ? BookingEntity.fromDatabase(booking) : null;
    } catch (error) {
      logger.error("Error finding booking by ID", {
        error: error.message,
        bookingId,
      });
      throw new DatabaseError("Failed to find booking", error);
    }
  }

  /**
   * Find booking by user and ad
   */
  async findByUserAndAd(userId, adId, status = "active") {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          user_id: BigInt(userId),
          ad_id: BigInt(adId),
          status,
        },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              price: true,
              user_id: true,
            },
          },
          user: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
      });

      if (!booking) {
        return null;
      }

      // Safely convert BigInt fields to strings for JSON serialization
      const safeBooking = {
        ...booking,
        id: booking.id,
        ad_id: booking.ad_id,
        user_id: booking.user_id,
        ad: booking.ad
          ? {
              ...booking.ad,
              id: booking.ad.id,
              user_id: booking.ad.user_id,
            }
          : null,
        user: booking.user
          ? {
              ...booking.user,
              user_id: booking.user.user_id,
            }
          : null,
      };

      return BookingEntity.fromDatabase(safeBooking);
    } catch (error) {
      logger.error("Error finding booking by user and ad", {
        error: error.message,
        stack: error.stack,
        userId,
        adId,
      });
      throw new DatabaseError("Failed to find booking", error);
    }
  }

  /**
   * Get active bookings for an ad
   */
  async findActiveBookingsByAd(adId) {
    try {
      const bookings = await prisma.booking.findMany({
        where: {
          ad_id: BigInt(adId),
          status: "active",
        },
        include: {
          user: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
        orderBy: { booking_order: "asc" },
      });

      return bookings.map((booking) => BookingEntity.fromDatabase(booking));
    } catch (error) {
      logger.error("Error finding active bookings by ad", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to find active bookings", error);
    }
  }

  /**
   * Get all bookings for an ad (including cancelled)
   */
  async findAllBookingsByAd(adId) {
    try {
      const bookings = await prisma.booking.findMany({
        where: {
          ad_id: BigInt(adId),
        },
        include: {
          user: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { booking_order: "asc" }],
      });

      return bookings.map((booking) => BookingEntity.fromDatabase(booking));
    } catch (error) {
      logger.error("Error finding all bookings by ad", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to find bookings", error);
    }
  }

  /**
   * Get user's bookings
   */
  async findUserBookings(userId, status = null) {
    try {
      const where = {
        user_id: BigInt(userId),
      };

      if (status) {
        where.status = status;
      }

      const bookings = await prisma.booking.findMany({
        where,
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              price: true,
              user_id: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      });

      return bookings.map((booking) => BookingEntity.fromDatabase(booking));
    } catch (error) {
      logger.error("Error finding user bookings", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to find user bookings", error);
    }
  }

  /**
   * Count active bookings for an ad
   */
  async countActiveBookings(adId) {
    try {
      const count = await prisma.booking.count({
        where: {
          ad_id: BigInt(adId),
          status: "active",
        },
      });

      return count;
    } catch (error) {
      logger.error("Error counting active bookings", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to count active bookings", error);
    }
  }

  /**
   * Cancel booking
   */
  async cancel(bookingId) {
    try {
      const booking = await prisma.booking.update({
        where: { id: BigInt(bookingId) },
        data: {
          status: "cancelled",
          cancelled_at: new Date(),
        },
        include: {
          ad: {
            select: {
              id: true,
              title: true,
              price: true,
              user_id: true,
            },
          },
          user: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
      });

      return BookingEntity.fromDatabase(booking);
    } catch (error) {
      logger.error("Error cancelling booking", {
        error: error.message,
        bookingId,
      });
      throw new DatabaseError("Failed to cancel booking", error);
    }
  }

  /**
   * Delete booking (hard delete)
   */
  async delete(bookingId) {
    try {
      await prisma.booking.delete({
        where: { id: BigInt(bookingId) },
      });

      return true;
    } catch (error) {
      logger.error("Error deleting booking", {
        error: error.message,
        bookingId,
      });
      throw new DatabaseError("Failed to delete booking", error);
    }
  }

  /**
   * Check if user has active booking for ad
   */
  async hasActiveBooking(userId, adId) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          user_id: BigInt(userId),
          ad_id: BigInt(adId),
          status: "active",
        },
      });

      return !!booking;
    } catch (error) {
      logger.error("Error checking active booking", {
        error: error.message,
        userId,
        adId,
      });
      throw new DatabaseError("Failed to check active booking", error);
    }
  }

  /**
   * Get booking statistics for ad
   */
  async getAdBookingStats(adId) {
    try {
      const [activeCount, totalCount, bookings] = await Promise.all([
        prisma.booking.count({
          where: { ad_id: BigInt(adId), status: "active" },
        }),
        prisma.booking.count({
          where: { ad_id: BigInt(adId) },
        }),
        prisma.booking.findMany({
          where: { ad_id: BigInt(adId), status: "active" },
          include: {
            user: {
              select: {
                user_id: true,
                first_name: true,
                username: true,
              },
            },
          },
          orderBy: { booking_order: "asc" },
          take: 10,
        }),
      ]);

      return {
        activeCount,
        totalCount,
        cancelledCount: totalCount - activeCount,
        bookings: bookings.map((b) => BookingEntity.fromDatabase(b)),
      };
    } catch (error) {
      logger.error("Error getting ad booking stats", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to get ad booking stats", error);
    }
  }
}

export default new BookingRepository();
