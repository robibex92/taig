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
    const ids = await this.houseRepository.findIdsByHouseNumber(houseKey);

    if (!ids.length) {
      throw new NotFoundError("House");
    }

    const comment = await this.entranceCommentRepository.findByHouseIdsAndEntrance(
      ids,
      entranceNumber
    );

    // `houseKey` — точное значение колонки `houses.house`, поэтому `37` и `37/1`
    // здесь не пересекаются.
    return {
      house: houseKey,
      entrance: entranceNumber,
      comment: comment ? comment.comment : null,
    };
  }
}
