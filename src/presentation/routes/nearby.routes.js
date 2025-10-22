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

// ================== HOUSE COMMENTS ==================

/**
 * @route   GET /nearby/test-comments
 * @desc    Test endpoint for comments
 * @access  Public
 */
router.get("/nearby/test-comments", async (req, res) => {
  try {
    res.json({
      message: "Comments API is working",
      timestamp: new Date().toISOString(),
      tables: "Checking if tables exist...",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /nearby/:house_id/comments
 * @desc    Get comments for a specific house
 * @access  Public
 */
router.get("/nearby/:house_id/comments", houseController.getHouseComments);

/**
 * @route   GET /nearby/comments
 * @desc    Get comments for a specific house by house number (query param)
 * @access  Public
 */
router.get("/nearby/comments", houseController.getHouseCommentsByNumber);

/**
 * @route   GET /nearby/:house_id/comment
 * @desc    Get latest comment for a specific house (simplified)
 * @access  Public
 */
router.get("/nearby/:house_id/comment", houseController.getHouseComment);

/**
 * @route   GET /nearby/comment
 * @desc    Get latest comment for a specific house by house number (simplified, query param)
 * @access  Public
 */
router.get("/nearby/comment", houseController.getHouseCommentByNumber);

/**
 * @route   POST /nearby/:house_id/comments
 * @desc    Create a comment for a house (admin only)
 * @access  Private (Admin only)
 */
router.post(
  "/nearby/:house_id/comments",
  authenticateJWT,
  houseController.createHouseComment
);

/**
 * @route   POST /nearby/comments
 * @desc    Create a comment for a house by house number (admin only)
 * @access  Private (Admin only)
 */
router.post(
  "/nearby/comments",
  authenticateJWT,
  houseController.createHouseCommentByNumber
);

/**
 * @route   PUT /nearby/comments/:comment_id
 * @desc    Update a house comment (admin only)
 * @access  Private (Admin only)
 */
router.put(
  "/nearby/comments/:comment_id",
  authenticateJWT,
  houseController.updateHouseComment
);

/**
 * @route   DELETE /nearby/comments/:comment_id
 * @desc    Delete a house comment (admin only)
 * @access  Private (Admin only)
 */
router.delete(
  "/nearby/comments/:comment_id",
  authenticateJWT,
  houseController.deleteHouseComment
);

// ================== ENTRANCE COMMENTS ==================

/**
 * @route   GET /nearby/:house_id/entrances/:entrance/comments
 * @desc    Get comment for a specific house entrance
 * @access  Public
 */
router.get(
  "/nearby/:house_id/entrances/:entrance/comments",
  houseController.getEntranceComment
);

/**
 * @route   GET /nearby/:house_id/entrances/:entrance/comment
 * @desc    Get comment for a specific house entrance (simplified)
 * @access  Public
 */
router.get(
  "/nearby/:house_id/entrances/:entrance/comment",
  houseController.getEntranceCommentSimple
);

/**
 * @route   POST /nearby/:house_id/entrances/:entrance/comments
 * @desc    Create a comment for a house entrance (admin only)
 * @access  Private (Admin only)
 */
router.post(
  "/nearby/:house_id/entrances/:entrance/comments",
  authenticateJWT,
  houseController.createEntranceComment
);

/**
 * @route   PUT /nearby/entrance-comments/:comment_id
 * @desc    Update an entrance comment (admin only)
 * @access  Private (Admin only)
 */
router.put(
  "/nearby/entrance-comments/:comment_id",
  authenticateJWT,
  houseController.updateEntranceComment
);

/**
 * @route   DELETE /nearby/entrance-comments/:comment_id
 * @desc    Delete an entrance comment (admin only)
 * @access  Private (Admin only)
 */
router.delete(
  "/nearby/entrance-comments/:comment_id",
  authenticateJWT,
  houseController.deleteEntranceComment
);

export default router;
