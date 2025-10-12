const express = require("express");
const { authenticateJWT } = require("../../core/middlewares/authMiddleware");

module.exports = (container) => {
  const router = express.Router();
  const commentController = container.get("CommentController");

  /**
   * @route   POST /api/v1/comments
   * @desc    Create a new comment or reply
   * @access  Private (authenticated users)
   */
  router.post("/", authenticateJWT, commentController.createComment);

  /**
   * @route   GET /api/v1/comments/ad/:adId
   * @desc    Get all comments for an ad
   * @access  Public
   */
  router.get("/ad/:adId", commentController.getComments);

  /**
   * @route   GET /api/v1/comments/ad/:adId/tree
   * @desc    Get comment tree (nested structure) for an ad
   * @access  Public
   */
  router.get("/ad/:adId/tree", commentController.getCommentTree);

  /**
   * @route   PATCH /api/v1/comments/:id
   * @desc    Update a comment
   * @access  Private (comment owner)
   */
  router.patch("/:id", authenticateJWT, commentController.updateComment);

  /**
   * @route   DELETE /api/v1/comments/:id
   * @desc    Delete a comment (soft delete)
   * @access  Private (comment owner, moderator, or admin)
   */
  router.delete("/:id", authenticateJWT, commentController.deleteComment);

  return router;
};
