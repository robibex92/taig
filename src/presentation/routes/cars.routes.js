import express from "express";
import { container } from "../../infrastructure/container/Container.js";

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
 * @route   POST /cars
 * @desc    Create new car
 * @access  Private (add auth middleware if needed)
 */
router.post("/cars", carController.create);

/**
 * @route   DELETE /cars/:id
 * @desc    Soft delete car
 * @access  Private (add auth middleware if needed)
 */
router.delete("/cars/:id", carController.delete);

export default router;
