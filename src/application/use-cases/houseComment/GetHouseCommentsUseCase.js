import { IHouseCommentRepository } from "../../../domain/repositories/IHouseCommentRepository.js";
import { ValidationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Get House Comments Use Case
 *
 * Два разных адресата, и путать их нельзя:
 *   `execute(id)` — маршрут `/nearby/:house_id/comments`, где в параметре лежит
 *   id записи квартиры;
 *   `executeByNumber(number)` / `executeSimple(number)` — маршрут
 *   `/nearby/comments?house=37`, где лежит номер дома.
 *
 * Раньше выбор делался через `isNaN(houseKey)`, и номер «37» (он же число!)
 * уезжал в поиск по id записи: тултип дома 37 показывал комментарий квартиры с
 * id 37 — то есть чужого здания — а дома с дробью (`37/1`) работали правильно.
 */
export class GetHouseCommentsUseCase {
  constructor(houseCommentRepository) {
    this.houseCommentRepository = houseCommentRepository;
  }

  #requireHouse(house) {
    if (!house) {
      throw new ValidationError("House ID or number is required");
    }
  }

  /** Комментарии по id записи дома (маршрут с `:house_id` в пути). */
  async execute(house_id) {
    this.#requireHouse(house_id);

    return this.#swallow(() =>
      this.houseCommentRepository.findByHouseId(parseInt(house_id))
    );
  }

  /** Комментарии по номеру дома: `37`, `39/1`. */
  async executeByNumber(house_number) {
    this.#requireHouse(house_number);

    return this.#swallow(() =>
      this.houseCommentRepository.findByHouseNumber(String(house_number))
    );
  }

  async executeSimple(house_number) {
    this.#requireHouse(house_number);

    const comment = await this.#swallow(
      () =>
        this.houseCommentRepository.findSimpleCommentByHouseNumber(
          String(house_number)
        ),
      null
    );

    return comment;
  }

  /** Таблица комментариев могла не появиться после миграции — страница не должна падать. */
  async #swallow(read, empty = []) {
    try {
      return await read();
    } catch (error) {
      logger.error("Error getting house comments:", error);

      if (error.code === "P2021" || String(error.message).includes("does not exist")) {
        return empty;
      }

      throw error;
    }
  }
}
