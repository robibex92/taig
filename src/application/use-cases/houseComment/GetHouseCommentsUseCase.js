import { IHouseCommentRepository } from "../../../domain/repositories/IHouseCommentRepository.js";
import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * Get House Comments Use Case
 * Gets all comments for a specific house
 */
export class GetHouseCommentsUseCase {
  constructor(houseCommentRepository) {
    this.houseCommentRepository = houseCommentRepository;
  }

  async execute(house_id) {
    try {
      if (!house_id) {
        throw new ValidationError("House ID is required");
      }

      const comments = await this.houseCommentRepository.findByHouseId(
        house_id
      );
      return comments;
    } catch (error) {
      console.error("Error getting house comments:", error);
      // Если это ошибка "таблица не найдена", возвращаем пустой массив
      if (error.code === "P2021" || error.message.includes("does not exist")) {
        console.log("Table does not exist yet, returning empty array");
        return [];
      }
      throw error;
    }
  }
}
