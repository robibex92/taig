import { IEntranceCommentRepository } from "../../../domain/repositories/IEntranceCommentRepository.js";
import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * Get Entrance Comment Use Case
 * Gets comment for a specific house entrance
 */
export class GetEntranceCommentUseCase {
  constructor(entranceCommentRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
  }

  async execute(house_id, entrance) {
    try {
      console.log(
        `GetEntranceCommentUseCase.execute called with house_id=${house_id}, entrance=${entrance}`
      );

      if (!house_id || !entrance) {
        throw new ValidationError("House ID and entrance are required");
      }

      const comment =
        await this.entranceCommentRepository.findByHouseAndEntrance(
          house_id,
          entrance
        );

      console.log(
        `GetEntranceCommentUseCase result:`,
        comment ? "found" : "not found"
      );
      return comment; // Может быть null если комментарий не найден
    } catch (error) {
      console.error("Error getting entrance comment:", error);
      // Если это ошибка "таблица не найдена", возвращаем null
      if (error.code === "P2021" || error.message.includes("does not exist")) {
        console.log("Table does not exist yet, returning null");
        return null;
      }
      throw error;
    }
  }
}
