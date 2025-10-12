import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const carController = container.resolve("carController");

/**
 * @route   GET /api/v1/cars
 * @desc    Get all active cars
 * @access  Public
 */
router.get("/api/v1/cars", carController.getAll);

/**
 * @route   GET /api/v1/cars/user/:user_id
 * @desc    Get cars by user ID
 * @access  Public
 */
router.get("/api/v1/cars/user/:user_id", carController.getUserCars);

/**
 * @route   POST /api/v1/cars
 * @desc    Create new car
 * @access  Private (add auth middleware if needed)
 */
router.post("/api/v1/cars", carController.create);

/**
 * @route   DELETE /api/v1/cars/:id
 * @desc    Soft delete car
 * @access  Private (add auth middleware if needed)
 */
router.delete("/api/v1/cars/:id", carController.delete);

export default router;
