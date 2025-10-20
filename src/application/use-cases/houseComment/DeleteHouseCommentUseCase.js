import { IHouseCommentRepository } from "../../../domain/repositories/IHouseCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/AppError.js";

/**
 * Delete House Comment Use Case
 * Deletes a house comment (admin only)
 */
export class DeleteHouseCommentUseCase {
  constructor(houseCommentRepository) {
    this.houseCommentRepository = houseCommentRepository;
  }

  async execute(commentId, userId) {
    try {
      if (!commentId) {
        throw new ValidationError("Comment ID is required");
      }

      // Check if user can manage this comment
      const canManage = await this.houseCommentRepository.canUserManage(
        commentId,
        userId
      );
      if (!canManage) {
        throw new ForbiddenError(
          "You don't have permission to delete this comment"
        );
      }

      // Delete the comment
      await this.houseCommentRepository.delete(commentId);
      return true;
    } catch (error) {
      console.error("Error deleting house comment:", error);
      throw error;
    }
  }
}
