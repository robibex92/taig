import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";

const carImageUploadService = container.resolve("carImageUploadService");
const upload = carImageUploadService.getMulterConfig();

const router = express.Router();
const carController = container.resolve("carController");

/**
 * @route   GET /cars
 * @desc    Get all active cars
 * @access  Public
 */
router.get("/cars", carController.getAll);

/**
 * @route   GET /cars/user/:user_id
 * @desc    Get cars by user ID
 * @access  Public
 */
router.get("/cars/user/:user_id", carController.getUserCars);

/**
 * @route   GET /cars/:id
 * @desc    Get car by ID
 * @access  Public
 */
router.get("/cars/:id", carController.getById);

/**
 * @route   POST /cars
 * @desc    Create new car
 * @access  Private
 */
router.post("/cars", authenticateJWT, carController.create);

/**
 * @route   DELETE /cars/:id
 * @desc    Soft delete car
 * @access  Private
 */
router.delete("/cars/:id", authenticateJWT, carController.delete);

// ============================================
// CAR IMAGES (Gallery functionality)
// ============================================

/**
 * @route   GET /cars/:id/images
 * @desc    Get all images for a specific car
 * @access  Public
 */
router.get("/cars/:id/images", carController.getCarImages);

/**
 * @route   POST /cars/:id/images
 * @desc    Add new image to car gallery (supports file upload and URL)
 * @access  Private
 */
router.post(
  "/cars/:id/images",
  authenticateJWT,
  upload.single("image"),
  carController.addCarImage
);

/**
 * @route   PATCH /cars/images/:imageId
 * @desc    Update car image (mainly for comments)
 * @access  Private
 */
router.patch(
  "/cars/images/:imageId",
  authenticateJWT,
  carController.updateCarImage
);

/**
 * @route   DELETE /cars/images/:imageId
 * @desc    Delete car image
 * @access  Private
 */
router.delete(
  "/cars/images/:imageId",
  authenticateJWT,
  carController.deleteCarImage
);

// ============================================
// CAR ADMIN NOTES (Admin only)
// ============================================

/**
 * @route   GET /cars/:id/admin-notes
 * @desc    Get admin notes for a specific car
 * @access  Private (Admin only)
 */
router.get(
  "/cars/:id/admin-notes",
  authenticateJWT,
  requireAdmin,
  carController.getCarAdminNotes
);

/**
 * @route   POST /cars/:id/admin-notes
 * @desc    Add admin note to car
 * @access  Private (Admin only)
 */
router.post(
  "/cars/:id/admin-notes",
  authenticateJWT,
  requireAdmin,
  carController.addCarAdminNote
);

/**
 * @route   PATCH /cars/admin-notes/:noteId
 * @desc    Update admin note
 * @access  Private (Admin only)
 */
router.patch(
  "/cars/admin-notes/:noteId",
  authenticateJWT,
  requireAdmin,
  carController.updateCarAdminNote
);

/**
 * @route   DELETE /cars/admin-notes/:noteId
 * @desc    Delete admin note
 * @access  Private (Admin only)
 */
router.delete(
  "/cars/admin-notes/:noteId",
  authenticateJWT,
  requireAdmin,
  carController.deleteCarAdminNote
);

// ============================================
// CAR MANAGEMENT (Admin only)
// ============================================

/**
 * @route   POST /cars/merge
 * @desc    Merge two cars with the same number
 * @access  Private (Admin only)
 */
router.post(
  "/cars/merge",
  authenticateJWT,
  requireAdmin,
  carController.mergeCars
);

/**
 * @route   POST /cars/:id/assign
 * @desc    Assign car to user
 * @access  Private (Admin only)
 */
router.post(
  "/cars/:id/assign",
  authenticateJWT,
  requireAdmin,
  carController.assignCarToUser
);

export default router;
