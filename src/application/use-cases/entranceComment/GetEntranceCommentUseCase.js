import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";

/**
 * Get Entrance Comment Use Case
 *
 * Отдаёт форму ответа `{house, entrance, comment}` — ровно ту, что читает
 * `houseCommentsApi.getEntranceComment(Simple)`: `{comment: "текст"}` либо
 * `{comment: null}`, если комментариев не было.
 */
export class GetEntranceCommentUseCase {
  constructor(entranceCommentRepository, houseRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
    this.houseRepository = houseRepository;
  }

  async execute(house_id, entrance) {
    const entranceNumber = Number(entrance);

    if (!Number.isInteger(entranceNumber) || entranceNumber <= 0) {
      throw new ValidationError("Invalid entrance number");
    }

    const houseKey = String(house_id ?? "").trim();
    const house = await this.houseRepository.findByHouseNumber(houseKey);

    if (!house) {
      throw new NotFoundError("House");
    }

    let comment = await this.entranceCommentRepository.findByHouseAndEntrance(
      house.id,
      entranceNumber
    );

    // Легаси: часть старых строк хранит в `house_id` номер дома вместо id записи.
    if (!comment && /^\d+$/.test(houseKey)) {
      comment = await this.entranceCommentRepository.findByHouseAndEntrance(
        BigInt(houseKey),
        entranceNumber
      );
    }

    return {
      house: house.house,
      entrance: entranceNumber,
      comment: comment ? comment.comment : null,
    };
  }
}
