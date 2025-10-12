const express = require("express");
const { authenticateJWT } = require("../../core/middlewares/authMiddleware");

module.exports = (container) => {
  const router = express.Router();
  const bookingController = container.get("BookingController");

  /**
   * @route   POST /api/v1/bookings
   * @desc    Create a new booking
   * @access  Private (authenticated users)
   */
  router.post("/", authenticateJWT, bookingController.createBooking);

  /**
   * @route   GET /api/v1/bookings/ad/:adId
   * @desc    Get all bookings for an ad (seller only)
   * @access  Private (ad owner)
   */
  router.get("/ad/:adId", authenticateJWT, bookingController.getBookingsByAd);

  /**
   * @route   GET /api/v1/bookings/ad/:adId/queue
   * @desc    Get booking queue for an ad
   * @access  Public
   */
  router.get("/ad/:adId/queue", bookingController.getBookingQueue);

  /**
   * @route   PATCH /api/v1/bookings/:id/status
   * @desc    Update booking status (confirm/reject) - seller only
   * @access  Private (ad owner)
   */
  router.patch(
    "/:id/status",
    authenticateJWT,
    bookingController.updateBookingStatus
  );

  /**
   * @route   DELETE /api/v1/bookings/:id
   * @desc    Cancel a booking
   * @access  Private (booking owner)
   */
  router.delete("/:id", authenticateJWT, bookingController.cancelBooking);

  return router;
};
