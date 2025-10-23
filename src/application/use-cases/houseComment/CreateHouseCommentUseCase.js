import { IHouseCommentRepository } from "../../../domain/repositories/IHouseCommentRepository.js";
import {
  ValidationError,
  ForbiddenError,
} from "../../../core/errors/AppError.js";

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

      // Теперь house_id - это номер дома как строка (например, "39" или "39/1")
      const houseNumber = String(house_id);

      // Проверяем, существует ли уже комментарий для этого дома
      const existingComments = await this.houseCommentRepository.findByHouseNumber(houseNumber);
      
      if (existingComments.length > 0) {
        // Если комментарий существует, обновляем первый (самый новый)
        const existingComment = existingComments[0];
        const updatedComment = await this.houseCommentRepository.update(existingComment.id, {
          comment: comment.trim(),
        });
        return updatedComment;
      } else {
        // Если комментария нет, создаем новый
        const newComment = await this.houseCommentRepository.create({
          house_id: houseNumber, // Передаем строку, репозиторий сам найдет house.id
          author_id: BigInt(author_id),
          comment: comment.trim(),
        });
        return newComment;
      }
    } catch (error) {
      console.error("Error creating/updating house comment:", error);
      throw error;
    }
  }
}
