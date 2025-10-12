const { asyncHandler } = require("../../core/middlewares/asyncHandler");

/**
 * Comment Controller
 * Handles all comment-related requests
 */
class CommentController {
  constructor({
    createCommentUseCase,
    getCommentsUseCase,
    updateCommentUseCase,
    deleteCommentUseCase,
    getCommentTreeUseCase,
  }) {
    this.createCommentUseCase = createCommentUseCase;
    this.getCommentsUseCase = getCommentsUseCase;
    this.updateCommentUseCase = updateCommentUseCase;
    this.deleteCommentUseCase = deleteCommentUseCase;
    this.getCommentTreeUseCase = getCommentTreeUseCase;
  }

  /**
   * Create a new comment
   * POST /api/v1/comments
   */
  createComment = asyncHandler(async (req, res) => {
    const { ad_id, content, parent_id } = req.body;
    const user_id = req.user.id;

    const comment = await this.createCommentUseCase.execute({
      ad_id,
      user_id,
      content,
      parent_id,
    });

    res.status(201).json({
      success: true,
      data: comment,
      message: "Comment created successfully",
    });
  });

  /**
   * Get comments for an ad
   * GET /api/v1/comments/ad/:adId
   */
  getComments = asyncHandler(async (req, res) => {
    const { adId } = req.params;
    const { includeDeleted } = req.query;

    const comments = await this.getCommentsUseCase.execute({
      ad_id: parseInt(adId),
      includeDeleted: includeDeleted === "true",
    });

    res.json({
      success: true,
      data: comments,
      count: comments.length,
    });
  });

  /**
   * Get comment tree (nested structure)
   * GET /api/v1/comments/ad/:adId/tree
   */
  getCommentTree = asyncHandler(async (req, res) => {
    const { adId } = req.params;

    const commentTree = await this.getCommentTreeUseCase.execute({
      ad_id: parseInt(adId),
    });

    res.json({
      success: true,
      data: commentTree,
    });
  });

  /**
   * Update a comment
   * PATCH /api/v1/comments/:id
   */
  updateComment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user.id;

    const comment = await this.updateCommentUseCase.execute({
      comment_id: parseInt(id),
      user_id,
      content,
    });

    res.json({
      success: true,
      data: comment,
      message: "Comment updated successfully",
    });
  });

  /**
   * Delete a comment (soft delete)
   * DELETE /api/v1/comments/:id
   */
  deleteComment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    const isAdmin =
      req.user.status === "admin" || req.user.status === "moderator";

    await this.deleteCommentUseCase.execute({
      comment_id: parseInt(id),
      user_id,
      isAdmin,
    });

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  });
}

module.exports = CommentController;
