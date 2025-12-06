import { IEntranceCommentRepository } from "../../../domain/repositories/IEntranceCommentRepository.js";
import { ValidationError, ForbiddenError } from "../../../core/errors/AppError.js";

/**
 * Create Entrance Comment Use Case
 * Creates a new comment for a house entrance (admin only)
 */
export class CreateEntranceCommentUseCase {
  constructor(entranceCommentRepository, houseRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
    this.houseRepository = houseRepository;
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

      // Find house ID from house number
      const houses = await this.houseRepository.findByFilters({ house: house_id });
      if (!houses || houses.length === 0) {
        throw new ValidationError(`House with number ${house_id} not found`);
      }
      const house = houses[0];

      // Create the comment
      const newComment = await this.entranceCommentRepository.create({
        house_id: house.id,
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
