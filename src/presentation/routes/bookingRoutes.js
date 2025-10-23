import express from "express";
import BookingController from "../controllers/BookingController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Authentication middleware will be applied per route

/**
 * @route   GET /api/users/me/bookings
 * @desc    Get current user's bookings
 * @access  Private
 */
router.get(
  "/users/me/bookings",
  authenticate,
  BookingController.getUserBookings
);

/**
 * @route   POST /api/ads/:adId/bookings
 * @desc    Create a booking for an ad
 * @access  Private
 */
router.post(
  "/ads/:adId/bookings",
  authenticate,
  BookingController.createBooking
);

/**
 * @route   GET /api/ads/:adId/bookings
 * @desc    Get bookings for an ad
 * @access  Private
 */
router.get(
  "/ads/:adId/bookings",
  authenticate,
  BookingController.getAdBookings
);

/**
 * @route   GET /api/ads/:adId/bookings/stats
 * @desc    Get booking statistics for an ad
 * @access  Private
 */
router.get(
  "/ads/:adId/bookings/stats",
  authenticate,
  BookingController.getAdBookingStats
);

/**
 * @route   GET /api/ads/:adId/bookings/check
 * @desc    Check if user has booked an ad
 * @access  Private
 */
router.get(
  "/ads/:adId/bookings/check",
  authenticate,
  BookingController.checkUserBooking
);

/**
 * @route   PATCH /api/bookings/:bookingId/cancel
 * @desc    Cancel a booking
 * @access  Private
 */
router.patch(
  "/bookings/:bookingId/cancel",
  authenticate,
  BookingController.cancelBooking
);

export default router;
