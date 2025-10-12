const {
  NotFoundError,
  ValidationError,
} = require("../../../core/errors/AppError");

/**
 * Update Comment Use Case
 * Allows user to edit their own comment
 */
class UpdateCommentUseCase {
  constructor({ commentRepository }) {
    this.commentRepository = commentRepository;
  }

  async execute({ comment_id, user_id, content }) {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new ValidationError("Content is required");
    }

    if (content.length > 2000) {
      throw new ValidationError("Content must be less than 2000 characters");
    }

    // Get comment
    const comment = await this.commentRepository.findById(comment_id);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // Check if user can edit
    if (!comment.canBeEdited(user_id)) {
      throw new ValidationError(
        "Unauthorized: You can only edit your own comments"
      );
    }

    // Update comment
    const updatedComment = await this.commentRepository.update(
      comment_id,
      content
    );

    return updatedComment;
  }
}

module.exports = UpdateCommentUseCase;
