import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { GLOBAL_ROLES, SERVICE_ROLES } from "../../core/utils/roles.js";

const carImageUploadService = container.resolve("carImageUploadService");
const upload = carImageUploadService.getMulterConfig();

const router = express.Router();
const carController = container.resolve("carController");

/**
 * Gallery rule (single source of truth for the whole cars feature):
 *   - car IDENTITY (plate, brand, model, colour, owner) is public/searchable;
 *   - everything VISUAL or EDITORIAL (photos + their comments, admin notes,
 *     merge, owner assignment) requires `cars:admin` (or `global:admin`).
 * The only exception is reading a car's own gallery: the owner may see the
 * photos of their own car, which cannot be decided from the URL, so that
 * branch lives in GetCarImagesUseCase (still 403 for everyone else).
 */
const carsAdmin = requireRoles(SERVICE_ROLES.CARS_ADMIN, GLOBAL_ROLES.ADMIN);

/**
 * @route   GET /cars
 * @desc    Get all active cars (identity only, no gallery)
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
 * @route   PATCH /cars/:id
 * @desc    Update car by ID (residents edit their own car, admins any car)
 * @access  Private
 */
router.patch("/cars/:id", authenticateJWT, carController.update);

/**
 * @route   POST /cars
 * @desc    Create new car (residents register their own car)
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
// CAR IMAGES (Gallery — cars:admin, plus the car owner on GET)
// ============================================

/**
 * @route   GET /cars/:id/images
 * @desc    Get all images for a specific car
 * @access  Private (cars:admin, or the owner of this car)
 */
router.get("/cars/:id/images", authenticateJWT, carController.getCarImages);

/**
 * @route   POST /cars/:id/images
 * @desc    Add new image to car gallery (supports file upload and URL)
 * @access  Private (cars:admin)
 */
router.post(
  "/cars/:id/images",
  authenticateJWT,
  carsAdmin,
  upload.single("image"),
  carController.addCarImage
);

/**
 * @route   PATCH /cars/images/:imageId
 * @desc    Update car image (mainly for comments)
 * @access  Private (cars:admin)
 */
router.patch("/cars/images/:imageId", authenticateJWT, carsAdmin, carController.updateCarImage);

/**
 * @route   DELETE /cars/images/:imageId
 * @desc    Delete car image
 * @access  Private (cars:admin)
 */
router.delete("/cars/images/:imageId", authenticateJWT, carsAdmin, carController.deleteCarImage);

// ============================================
// CAR ADMIN NOTES (cars:admin)
// ============================================

/**
 * @route   GET /cars/:id/admin-notes
 * @desc    Get admin notes for a specific car
 * @access  Private (cars:admin)
 */
router.get("/cars/:id/admin-notes", authenticateJWT, carsAdmin, carController.getCarAdminNotes);

/**
 * @route   POST /cars/:id/admin-notes
 * @desc    Add admin note to car
 * @access  Private (cars:admin)
 */
router.post("/cars/:id/admin-notes", authenticateJWT, carsAdmin, carController.addCarAdminNote);

/**
 * @route   PATCH /cars/admin-notes/:noteId
 * @desc    Update admin note
 * @access  Private (cars:admin)
 */
router.patch("/cars/admin-notes/:noteId", authenticateJWT, carsAdmin, carController.updateCarAdminNote);

/**
 * @route   DELETE /cars/admin-notes/:noteId
 * @desc    Delete admin note
 * @access  Private (cars:admin)
 */
router.delete(
  "/cars/admin-notes/:noteId",
  authenticateJWT,
  carsAdmin,
  carController.deleteCarAdminNote
);

// ============================================
// CAR MANAGEMENT (cars:admin)
// ============================================

/**
 * @route   POST /cars/merge
 * @desc    Merge two cars with the same number
 * @access  Private (cars:admin)
 */
router.post("/cars/merge", authenticateJWT, carsAdmin, carController.mergeCars);

/**
 * @route   POST /cars/:id/assign
 * @desc    Assign car to user
 * @access  Private (cars:admin)
 */
router.post("/cars/:id/assign", authenticateJWT, carsAdmin, carController.assignCarToUser);

export default router;
