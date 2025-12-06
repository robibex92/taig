import { IEntranceCommentRepository } from "../../../domain/repositories/IEntranceCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/AppError.js";

/**
 * Create Entrance Comment Use Case
 * Creates a new comment for a house entrance (admin only)
 */
export class CreateEntranceCommentUseCase {
  constructor(entranceCommentRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
  }

  async execute({ house_id, entrance, author_id, comment }) {
    try {
      // Validate input
      if (!house_id || !entrance || !author_id || !comment?.trim()) {
        throw new ValidationError(
          "House ID, entrance, author ID, and comment are required"
        );
      }

      if (comment.trim().length > 1000) {
        throw new ValidationError("Comment cannot exceed 1000 characters");
      }

      // Create the comment
      const newComment = await this.entranceCommentRepository.create({
        house_id: house_id,
        entrance: parseInt(entrance),
        author_id: BigInt(author_id),
        comment: comment.trim(),
      });

      return newComment;
    } catch (error) {
      console.error("Error creating entrance comment:", error);
      throw error;
    }
  }
}
