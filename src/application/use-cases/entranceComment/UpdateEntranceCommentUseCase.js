import { IEntranceCommentRepository } from "../../../domain/repositories/IEntranceCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/AppError.js";

/**
 * Update Entrance Comment Use Case
 * Updates an existing entrance comment (admin only)
 */
export class UpdateEntranceCommentUseCase {
  constructor(entranceCommentRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
  }

  async execute(commentId, comment, userId) {
    try {
      // Validate input
      if (!commentId || !comment?.trim()) {
        throw new ValidationError("Comment ID and comment text are required");
      }

      if (comment.trim().length > 1000) {
        throw new ValidationError("Comment cannot exceed 1000 characters");
      }

      // Check if user can manage this comment
      const canManage = await this.entranceCommentRepository.canUserManage(
        commentId,
        userId
      );
      if (!canManage) {
        throw new ForbiddenError(
          "You don't have permission to update this comment"
        );
      }

      // Update the comment
      const updatedComment = await this.entranceCommentRepository.update(
        commentId,
        {
          comment: comment.trim(),
        }
      );

      return updatedComment;
    } catch (error) {
      console.error("Error updating entrance comment:", error);
      throw error;
    }
  }
}
