import asyncHandler from "express-async-handler";
import CreateBookingUseCase from "../../application/use-cases/booking/CreateBookingUseCase.js";
import CancelBookingUseCase from "../../application/use-cases/booking/CancelBookingUseCase.js";
import GetBookingsUseCase from "../../application/use-cases/booking/GetBookingsUseCase.js";
import { ValidationError } from "../../domain/errors/index.js";

/**
 * BookingController - handles HTTP requests for bookings
 */
export class BookingController {
  constructor(
    createBookingUseCase = CreateBookingUseCase,
    cancelBookingUseCase = CancelBookingUseCase,
    getBookingsUseCase = GetBookingsUseCase
  ) {
    this.createBookingUseCase = createBookingUseCase;
    this.cancelBookingUseCase = cancelBookingUseCase;
    this.getBookingsUseCase = getBookingsUseCase;
  }

  /**
   * Create a booking
   * POST /api/ads/:adId/bookings
   */
  createBooking = asyncHandler(async (req, res) => {
    const { adId } = req.params;
    const userId = req.user.user_id;

    if (!adId) {
      throw new ValidationError("Ad ID is required");
    }

    const result = await this.createBookingUseCase.execute({
      adId,
      userId,
    });

    res.status(201).json(result);
  });

  /**
   * Cancel a booking
   * PATCH /api/bookings/:bookingId/cancel
   */
  cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user.user_id;

    if (!bookingId) {
      throw new ValidationError("Booking ID is required");
    }

    const result = await this.cancelBookingUseCase.execute({
      bookingId,
      userId,
    });

    res.json(result);
  });

  /**
   * Get bookings for an ad
   * GET /api/ads/:adId/bookings
   */
  getAdBookings = asyncHandler(async (req, res) => {
    const { adId } = req.params;
    const { status = "active" } = req.query;

    if (!adId) {
      throw new ValidationError("Ad ID is required");
    }

    const result = await this.getBookingsUseCase.getAdBookings({
      adId,
      status,
    });

    res.json(result);
  });

  /**
   * Get user's bookings
   * GET /api/users/me/bookings
   */
  getUserBookings = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { status } = req.query;

    const result = await this.getBookingsUseCase.getUserBookings({
      userId,
      status,
    });

    res.json(result);
  });

  /**
   * Get booking statistics for an ad
   * GET /api/ads/:adId/bookings/stats
   */
  getAdBookingStats = asyncHandler(async (req, res) => {
    const { adId } = req.params;

    if (!adId) {
      throw new ValidationError("Ad ID is required");
    }

    const result = await this.getBookingsUseCase.getAdBookingStats({
      adId,
    });

    res.json(result);
  });

  /**
   * Check if user has booked an ad
   * GET /api/ads/:adId/bookings/check
   */
  checkUserBooking = asyncHandler(async (req, res) => {
    const { adId } = req.params;
    const userId = req.user.user_id;

    if (!adId) {
      throw new ValidationError("Ad ID is required");
    }

    const result = await this.getBookingsUseCase.checkUserBooking({
      userId,
      adId,
    });

    res.json(result);
  });
}

export default new BookingController();
