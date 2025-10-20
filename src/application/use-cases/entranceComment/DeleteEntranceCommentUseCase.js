import { IEntranceCommentRepository } from "../../../domain/repositories/IEntranceCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/AppError.js";

/**
 * Delete Entrance Comment Use Case
 * Deletes an entrance comment (admin only)
 */
export class DeleteEntranceCommentUseCase {
  constructor(entranceCommentRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
  }

  async execute(commentId, userId) {
    try {
      if (!commentId) {
        throw new ValidationError("Comment ID is required");
      }

      // Check if user can manage this comment
      const canManage = await this.entranceCommentRepository.canUserManage(
        commentId,
        userId
      );
      if (!canManage) {
        throw new ForbiddenError(
          "You don't have permission to delete this comment"
        );
      }

      // Delete the comment
      await this.entranceCommentRepository.delete(commentId);
      return true;
    } catch (error) {
      console.error("Error deleting entrance comment:", error);
      throw error;
    }
  }
}
