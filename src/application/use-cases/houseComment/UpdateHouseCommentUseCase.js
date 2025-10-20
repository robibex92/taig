import { IHouseCommentRepository } from "../../../domain/repositories/IHouseCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/AppError.js";

/**
 * Update House Comment Use Case
 * Updates an existing house comment (admin only)
 */
export class UpdateHouseCommentUseCase {
  constructor(houseCommentRepository) {
    this.houseCommentRepository = houseCommentRepository;
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
      const canManage = await this.houseCommentRepository.canUserManage(
        commentId,
        userId
      );
      if (!canManage) {
        throw new ForbiddenError(
          "You don't have permission to update this comment"
        );
      }

      // Update the comment
      const updatedComment = await this.houseCommentRepository.update(
        commentId,
        {
          comment: comment.trim(),
        }
      );

      return updatedComment;
    } catch (error) {
      console.error("Error updating house comment:", error);
      throw error;
    }
  }
}
