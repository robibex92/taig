import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();
const houseController = container.resolve("houseController");

/**
 * @route   GET /nearby/houses
 * @desc    Get all unique houses
 * @access  Public
 */
router.get("/nearby/houses", houseController.getUniqueHouses);

/**
 * @route   GET /nearby/entrances
 * @desc    Get entrances for a specific house
 * @access  Public
 */
router.get("/nearby/entrances", houseController.getEntrances);

/**
 * @route   GET /nearby
 * @desc    Get houses by filter (house, entrance, position)
 * @access  Public
 */
router.get("/nearby", houseController.getHousesByFilter);

/**
 * @route   GET /nearby/user/:id_telegram
 * @desc    Get all houses for a user
 * @access  Public
 */
router.get("/nearby/user/:id_telegram", houseController.getUserHouses);

/**
 * @route   GET /nearby/:id/info
 * @desc    Get info for a specific house
 * @access  Public
 */
router.get("/nearby/:id/info", houseController.getHouseInfo);

/**
 * @route   POST /nearby
 * @desc    Link user to apartment (create or update position)
 * @access  Private (add auth middleware if needed)
 */
router.post("/nearby", houseController.linkUserToApartment);

/**
 * @route   POST /nearby/unlink
 * @desc    Unlink user from apartment
 * @access  Private (add auth middleware if needed)
 */
router.post("/nearby/unlink", houseController.unlinkUserFromApartment);

/**
 * @route   PATCH /nearby/:id/info
 * @desc    Update house info (admin only)
 * @access  Private (Admin only)
 */
router.patch(
  "/nearby/:id/info",
  authenticateJWT,
  houseController.updateHouseInfo
);

export default router;
