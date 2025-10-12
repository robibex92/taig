import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const houseController = container.resolve("houseController");

/**
 * @route   GET /api/v1/nearby/houses
 * @desc    Get all unique houses
 * @access  Public
 */
router.get("/api/v1/nearby/houses", houseController.getUniqueHouses);

/**
 * @route   GET /api/v1/nearby/entrances
 * @desc    Get entrances for a specific house
 * @access  Public
 */
router.get("/api/v1/nearby/entrances", houseController.getEntrances);

/**
 * @route   GET /api/v1/nearby
 * @desc    Get houses by filter (house, entrance, position)
 * @access  Public
 */
router.get("/api/v1/nearby", houseController.getHousesByFilter);

/**
 * @route   GET /api/v1/nearby/user/:id_telegram
 * @desc    Get all houses for a user
 * @access  Public
 */
router.get("/api/v1/nearby/user/:id_telegram", houseController.getUserHouses);

/**
 * @route   GET /api/v1/nearby/:id/info
 * @desc    Get info for a specific house
 * @access  Public
 */
router.get("/api/v1/nearby/:id/info", houseController.getHouseInfo);

/**
 * @route   POST /api/v1/nearby
 * @desc    Link user to apartment (create or update position)
 * @access  Private (add auth middleware if needed)
 */
router.post("/api/v1/nearby", houseController.linkUserToApartment);

/**
 * @route   POST /api/v1/nearby/unlink
 * @desc    Unlink user from apartment
 * @access  Private (add auth middleware if needed)
 */
router.post("/api/v1/nearby/unlink", houseController.unlinkUserFromApartment);

export default router;
