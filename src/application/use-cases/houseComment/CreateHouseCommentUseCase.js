import { IHouseCommentRepository } from "../../../domain/repositories/IHouseCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/index.js";

/**
 * Create House Comment Use Case
 * Creates a new comment for a house (admin only)
 */
export class CreateHouseCommentUseCase {
  constructor(houseCommentRepository) {
    this.houseCommentRepository = houseCommentRepository;
  }

  async execute({ house_id, author_id, comment }) {
    try {
      // Validate input
      if (!house_id || !author_id || !comment?.trim()) {
        throw new ValidationError(
          "House ID, author ID, and comment are required"
        );
      }

      if (comment.trim().length > 1000) {
        throw new ValidationError("Comment cannot exceed 1000 characters");
      }

      // Create the comment
      const newComment = await this.houseCommentRepository.create({
        house_id: BigInt(house_id),
        author_id: BigInt(author_id),
        comment: comment.trim(),
      });

      return newComment;
    } catch (error) {
      console.error("Error creating house comment:", error);
      throw error;
    }
  }
}
