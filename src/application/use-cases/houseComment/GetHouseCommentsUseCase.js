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

  async execute(house_id_or_number) {
    try {
      if (!house_id_or_number) {
        throw new ValidationError("House ID or number is required");
      }

      // Если это число, используем поиск по house_id
      if (!isNaN(house_id_or_number)) {
        const comments = await this.houseCommentRepository.findByHouseId(
          parseInt(house_id_or_number)
        );
        return comments;
      } else {
        // Если это строка, используем поиск по номеру дома
        const comments = await this.houseCommentRepository.findByHouseNumber(
          house_id_or_number
        );
        return comments;
      }
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

  async executeSimple(house_number) {
    try {
      console.log(`executeSimple called with house_number: "${house_number}"`);
      
      if (!house_number) {
        throw new ValidationError("House number is required");
      }

      // Получаем только текст комментария без подробностей
      const comment =
        await this.houseCommentRepository.findSimpleCommentByHouseNumber(
          house_number
        );
      
      console.log(`executeSimple result: ${comment ? `"${comment}"` : 'null'}`);
      
      return comment;
    } catch (error) {
      console.error("Error getting simple house comment:", error);
      // Если это ошибка "таблица не найдена", возвращаем null
      if (error.code === "P2021" || error.message.includes("does not exist")) {
        console.log("Table does not exist yet, returning null");
        return null;
      }
      throw error;
    }
  }
}
