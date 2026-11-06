import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import { canViewHouse } from "../../../core/utils/roles.js";

/**
 * Get Entrance Comment Use Case
 *
 * Отдаёт форму ответа `{house, entrance, comment}` — ровно ту, что читает
 * `houseCommentsApi.getEntranceComment(Simple)`: `{comment: "текст"}` либо
 * `{comment: null}`, если комментариев не было.
 *
 * Текст подъездного чата видит тот же круг, что и сетка квартир этого дома
 * (`canViewHouse`): остальным возвращается `comment: null` — без ошибки и без
 * намёка на то, что что-то спрятано.
 */
export class GetEntranceCommentUseCase {
  constructor(entranceCommentRepository, houseRepository) {
    this.entranceCommentRepository = entranceCommentRepository;
    this.houseRepository = houseRepository;
  }

  async execute(house_id, entrance, viewer = null) {
    const entranceNumber = Number(entrance);

    if (!Number.isInteger(entranceNumber) || entranceNumber <= 0) {
      throw new ValidationError("Invalid entrance number");
    }

    const houseKey = String(house_id ?? "").trim();
    const house = await this.houseRepository.findByHouseNumber(houseKey);

    if (!house) {
      throw new NotFoundError("House");
    }

    if (!canViewHouse(viewer, house.house)) {
      return { house: house.house, entrance: entranceNumber, comment: null };
    }

    const comment = await this.entranceCommentRepository.findByHouseNumberAndEntrance(
      houseKey,
      entranceNumber
    );

    return {
      house: house.house,
      entrance: entranceNumber,
      comment: comment ? comment.comment : null,
    };
  }
}
