import express from "express";
import BookingController from "../controllers/BookingController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * All booking routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/users/me/bookings
 * @desc    Get current user's bookings
 * @access  Private
 */
router.get("/users/me/bookings", BookingController.getUserBookings);

/**
 * @route   POST /api/ads/:adId/bookings
 * @desc    Create a booking for an ad
 * @access  Private
 */
router.post("/ads/:adId/bookings", BookingController.createBooking);

/**
 * @route   GET /api/ads/:adId/bookings
 * @desc    Get bookings for an ad
 * @access  Private
 */
router.get("/ads/:adId/bookings", BookingController.getAdBookings);

/**
 * @route   GET /api/ads/:adId/bookings/stats
 * @desc    Get booking statistics for an ad
 * @access  Private
 */
router.get("/ads/:adId/bookings/stats", BookingController.getAdBookingStats);

/**
 * @route   GET /api/ads/:adId/bookings/check
 * @desc    Check if user has booked an ad
 * @access  Private
 */
router.get("/ads/:adId/bookings/check", BookingController.checkUserBooking);

/**
 * @route   PATCH /api/bookings/:bookingId/cancel
 * @desc    Cancel a booking
 * @access  Private
 */
router.patch("/bookings/:bookingId/cancel", BookingController.cancelBooking);

export default router;
