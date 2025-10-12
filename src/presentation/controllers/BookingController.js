const { asyncHandler } = require("../../core/middlewares/asyncHandler");

/**
 * Booking Controller
 * Handles all booking-related requests
 */
class BookingController {
  constructor({
    createBookingUseCase,
    getBookingsByAdUseCase,
    getBookingQueueUseCase,
    updateBookingStatusUseCase,
    cancelBookingUseCase,
  }) {
    this.createBookingUseCase = createBookingUseCase;
    this.getBookingsByAdUseCase = getBookingsByAdUseCase;
    this.getBookingQueueUseCase = getBookingQueueUseCase;
    this.updateBookingStatusUseCase = updateBookingStatusUseCase;
    this.cancelBookingUseCase = cancelBookingUseCase;
  }

  /**
   * Create a new booking
   * POST /api/v1/bookings
   */
  createBooking = asyncHandler(async (req, res) => {
    const { ad_id, message } = req.body;
    const user_id = req.user.id;

    const booking = await this.createBookingUseCase.execute({
      ad_id,
      user_id,
      message,
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: "Booking created successfully",
    });
  });

  /**
   * Get bookings for an ad (seller only)
   * GET /api/v1/bookings/ad/:adId
   */
  getBookingsByAd = asyncHandler(async (req, res) => {
    const { adId } = req.params;
    const { status } = req.query;
    const user_id = req.user.id;

    const bookings = await this.getBookingsByAdUseCase.execute({
      ad_id: parseInt(adId),
      user_id,
      status,
    });

    res.json({
      success: true,
      data: bookings,
      count: bookings.length,
    });
  });

  /**
   * Get booking queue for an ad
   * GET /api/v1/bookings/ad/:adId/queue
   */
  getBookingQueue = asyncHandler(async (req, res) => {
    const { adId } = req.params;

    const queue = await this.getBookingQueueUseCase.execute({
      ad_id: parseInt(adId),
    });

    res.json({
      success: true,
      data: queue,
      count: queue.length,
    });
  });

  /**
   * Update booking status (confirm/reject)
   * PATCH /api/v1/bookings/:id/status
   */
  updateBookingStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, seller_note } = req.body;
    const seller_id = req.user.id;

    const booking = await this.updateBookingStatusUseCase.execute({
      booking_id: parseInt(id),
      seller_id,
      status,
      seller_note,
    });

    res.json({
      success: true,
      data: booking,
      message: `Booking ${status} successfully`,
    });
  });

  /**
   * Cancel a booking
   * DELETE /api/v1/bookings/:id
   */
  cancelBooking = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    const booking = await this.cancelBookingUseCase.execute({
      booking_id: parseInt(id),
      user_id,
    });

    res.json({
      success: true,
      data: booking,
      message: "Booking cancelled successfully",
    });
  });
}

module.exports = BookingController;
