const {
  NotFoundError,
  ValidationError,
} = require("../../../core/errors/AppError");

/**
 * Delete Comment Use Case
 * Soft deletes a comment (user, moderator, or admin)
 */
class DeleteCommentUseCase {
  constructor({ commentRepository }) {
    this.commentRepository = commentRepository;
  }

  async execute({ comment_id, user_id, isAdmin = false }) {
    // Get comment
    const comment = await this.commentRepository.findById(comment_id);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // Check if user can delete
    if (!comment.canBeDeleted(user_id, isAdmin)) {
      throw new ValidationError(
        "Unauthorized: You can only delete your own comments"
      );
    }

    // Soft delete comment
    await this.commentRepository.softDelete(comment_id);

    return { success: true, message: "Comment deleted successfully" };
  }
}

module.exports = DeleteCommentUseCase;
