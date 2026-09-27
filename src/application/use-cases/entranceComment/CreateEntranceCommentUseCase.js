import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";

/**
 * Create Entrance Comment Use Case
 * Creates a new comment for a house entrance
 *
 * Права на запись здесь не проверяются — как и раньше, это открыто любому
 * вошедшему (гэйт по `house:<n>:manage` — отдельное решение, см. H6.2).
 */
export class CreateEntranceCommentUseCase {
  constructor(entranceCommentRepository, houseRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
    this.houseRepository = houseRepository;
  }

  async execute({ house_id, entrance, author_id, comment }) {
    const text = String(comment ?? "").trim();
    const entranceNumber = Number(entrance);

    if (!house_id || !Number.isInteger(entranceNumber) || entranceNumber <= 0) {
      throw new ValidationError("House and entrance are required");
    }

    if (!author_id) {
      throw new ValidationError("Author is required");
    }

    if (!text) {
      throw new ValidationError("Comment text is required");
    }

    if (text.length > 1000) {
      throw new ValidationError("Comment cannot exceed 1000 characters");
    }

    const house = await this.houseRepository.findByHouseNumber(house_id);

    if (!house) {
      // 404, а не 400: контроллер всегда отвечал так на неизвестный номер дома.
      throw new NotFoundError("House");
    }

    const created = await this.entranceCommentRepository.create({
      house_id: house.id,
      entrance: entranceNumber,
      author_id: BigInt(author_id),
      comment: text,
    });

    // Форма ответа прежняя: номер дома, подъезд, текст и id.
    return {
      id: created.id,
      house: house.house,
      entrance: entranceNumber,
      comment: created.comment,
    };
  }
}
