import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { validate } from "../../core/validation/validator.js";
import { ValidationError } from "../../core/errors/AppError.js";
import { resolveApartmentSubject } from "../../application/use-cases/house/apartmentAccess.js";
import {
  getEntrancesSchema,
  getHousesFilterSchema,
  houseCommentBodySchema,
  houseCommentByNumberSchema,
  houseCommentQuerySchema,
  userIdParamSchema,
  houseIdParamSchema,
  linkUserToApartmentSchema,
  unlinkUserFromApartmentSchema,
} from "../../core/validation/schemas/house.schema.js";

/**
 * House Controller
 * Handles HTTP requests for house/apartment operations.
 *
 * Зависимости передаются по именам: раньше их порядок в контейнере решал, какой
 * кейс попадёт в какой слот (16 позиционных аргументов), а комментарии подъездов
 * читались и писались прямым `prisma` отсюда, минуя репозиторий.
 */
export class HouseController {
  constructor({
    getUniqueHousesUseCase,
    getEntrancesByHouseUseCase,
    getHousesByFilterUseCase,
    getUserHousesUseCase,
    getHouseInfoUseCase,
    linkUserToApartmentUseCase,
    unlinkUserFromApartmentUseCase,
    updateHouseInfoUseCase,
    updateApartmentLayoutUseCase,
    createHouseCommentUseCase,
    getHouseCommentsUseCase,
    updateHouseCommentUseCase,
    deleteHouseCommentUseCase,
    createEntranceCommentUseCase,
    getEntranceCommentUseCase,
    updateEntranceCommentUseCase,
    deleteEntranceCommentUseCase,
  }) {
    this.getUniqueHousesUseCase = getUniqueHousesUseCase;
    this.getEntrancesByHouseUseCase = getEntrancesByHouseUseCase;
    this.getHousesByFilterUseCase = getHousesByFilterUseCase;
    this.getUserHousesUseCase = getUserHousesUseCase;
    this.getHouseInfoUseCase = getHouseInfoUseCase;
    this.linkUserToApartmentUseCase = linkUserToApartmentUseCase;
    this.unlinkUserFromApartmentUseCase = unlinkUserFromApartmentUseCase;
    this.updateHouseInfoUseCase = updateHouseInfoUseCase;
    this.updateApartmentLayoutUseCase = updateApartmentLayoutUseCase;
    this.createHouseCommentUseCase = createHouseCommentUseCase;
    this.getHouseCommentsUseCase = getHouseCommentsUseCase;
    this.updateHouseCommentUseCase = updateHouseCommentUseCase;
    this.deleteHouseCommentUseCase = deleteHouseCommentUseCase;
    this.createEntranceCommentUseCase = createEntranceCommentUseCase;
    this.getEntranceCommentUseCase = getEntranceCommentUseCase;
    this.updateEntranceCommentUseCase = updateEntranceCommentUseCase;
    this.deleteEntranceCommentUseCase = deleteEntranceCommentUseCase;
  }

  // ================== ДОМА И КВАРТИРЫ ==================

  /** GET /api-v1/nearby/houses */
  getUniqueHouses = asyncHandler(async (req, res) => {
    const houses = await this.getUniqueHousesUseCase.execute();

    res.json({ data: houses });
  });

  /** GET /api-v1/nearby/entrances */
  getEntrances = asyncHandler(async (req, res) => {
    const { house } = validate(getEntrancesSchema, req.query);
    const entrances = await this.getEntrancesByHouseUseCase.execute(house);

    res.json({ data: entrances });
  });

  /** GET /api-v1/nearby */
  getHousesByFilter = asyncHandler(async (req, res) => {
    const filters = validate(getHousesFilterSchema, req.query);
    const houses = await this.getHousesByFilterUseCase.execute(filters);

    res.json({ data: houses });
  });

  /** GET /api-v1/nearby/user/:id_telegram */
  getUserHouses = asyncHandler(async (req, res) => {
    const { id_telegram: idTelegram } = validate(userIdParamSchema, req.params);

    const subject = resolveApartmentSubject(req.user, idTelegram);
    const houses = await this.getUserHousesUseCase.execute(subject);

    res.json({ data: houses });
  });

  /** GET /api-v1/nearby/:id/info */
  getHouseInfo = asyncHandler(async (req, res) => {
    const { id } = validate(houseIdParamSchema, req.params);

    const info = await this.getHouseInfoUseCase.execute(id, req.user);

    res.json({ info });
  });

  /** POST /api-v1/nearby — привязка квартиры: обновляет позицию или создаёт новую. */
  linkUserToApartment = asyncHandler(async (req, res) => {
    const { house, number, id_telegram: idTelegram } = validate(
      linkUserToApartmentSchema,
      req.body
    );

    const result = await this.linkUserToApartmentUseCase.execute(
      house,
      number,
      idTelegram,
      req.user
    );

    // Кейс сам говорит, создана ли новая позиция: код ответа больше не выводится
    // из подстроки сообщения.
    res.status(result.created ? 201 : 200).json(result);
  });

  /** POST /api-v1/nearby/unlink */
  unlinkUserFromApartment = asyncHandler(async (req, res) => {
    const { id, id_telegram: idTelegram } = validate(
      unlinkUserFromApartmentSchema,
      req.body
    );

    const result = await this.unlinkUserFromApartmentUseCase.execute(
      id,
      idTelegram,
      req.user
    );

    res.json(result);
  });

  /** PATCH /api-v1/nearby/:id/info — текст информации о квартире. */
  updateHouseInfo = asyncHandler(async (req, res) => {
    const updatedHouse = await this.updateHouseInfoUseCase.execute(
      req.params.id,
      req.body.info,
      req.user
    );

    res.json({
      success: true,
      data: updatedHouse.toJSON(),
      message: "House info updated successfully",
    });
  });

  /** PATCH /api-v1/nearby/:id/layout — раскладка: этаж, колонка, ширина ячейки. */
  updateApartmentLayout = asyncHandler(async (req, res) => {
    const { floor, cellIndex, cellSpan } = req.body;

    const updatedHouse = await this.updateApartmentLayoutUseCase.execute(
      req.params.id,
      { floor, cellIndex, cellSpan },
      req.user
    );

    res.json({
      success: true,
      data: updatedHouse.toFilteredJSON(),
    });
  });

  // ================== КОММЕНТАРИИ ДОМОВ ==================

  /** POST /api-v1/nearby/:house_id/comments */
  createHouseComment = asyncHandler(async (req, res) => {
    const newComment = await this.createHouseCommentUseCase.execute({
      // `house_id` из URL — это и id записи, и номер дома: кейс различает сам.
      house_id: req.params.house_id,
      author_id: req.user.user_id,
      comment: validate(houseCommentBodySchema, req.body).comment,
      user: req.user,
    });

    res.status(201).json(newComment);
  });

  /** POST /api-v1/nearby/comments — дом по номеру в теле */
  createHouseCommentByNumber = asyncHandler(async (req, res) => {
    const { house, comment } = validate(houseCommentByNumberSchema, req.body);

    const newComment = await this.createHouseCommentUseCase.execute({
      house_id: house,
      author_id: req.user.user_id,
      comment,
      user: req.user,
    });

    res.status(201).json(newComment);
  });

  /** GET /api-v1/nearby/:house_id/comments */
  getHouseComments = asyncHandler(async (req, res) => {
    const comments = await this.getHouseCommentsUseCase.execute(
      req.params.house_id
    );

    res.json(comments);
  });

  /** GET /api-v1/nearby/comments?house=HOUSE_NUMBER */
  getHouseCommentsByNumber = asyncHandler(async (req, res) => {
    const { house } = validate(houseCommentQuerySchema, req.query);
    const comments = await this.getHouseCommentsUseCase.execute(house);

    res.json(comments);
  });

  /** GET /api-v1/nearby/:house_id/comment — только текст последнего комментария. */
  getHouseComment = asyncHandler(async (req, res) => {
    const comment = await this.#latestHouseComment(req.params.house_id);

    res.json(comment ? { comment } : null);
  });

  /** GET /api-v1/nearby/comment?house=HOUSE_NUMBER */
  getHouseCommentByNumber = asyncHandler(async (req, res) => {
    const { house } = validate(houseCommentQuerySchema, req.query);
    const comment = await this.#latestHouseComment(house);

    res.json(comment ? { comment } : null);
  });

  /** PUT /api-v1/nearby/comments/:comment_id */
  updateHouseComment = asyncHandler(async (req, res) => {
    const updatedComment = await this.updateHouseCommentUseCase.execute(
      parseInt(req.params.comment_id),
      validate(houseCommentBodySchema, req.body).comment,
      req.user.user_id
    );

    res.json(updatedComment);
  });

  /** DELETE /api-v1/nearby/comments/:comment_id */
  deleteHouseComment = asyncHandler(async (req, res) => {
    await this.deleteHouseCommentUseCase.execute(
      parseInt(req.params.comment_id),
      req.user.user_id
    );

    res.status(204).send();
  });

  // ================== КОММЕНТАРИИ ПОДЪЕЗДОВ ==================

  /** POST /api-v1/nearby/:house_id/entrances/:entrance/comments */
  createEntranceComment = asyncHandler(async (req, res) => {
    const result = await this.createEntranceCommentUseCase.execute({
      house_id: req.params.house_id,
      entrance: req.params.entrance,
      author_id: req.user.user_id,
      comment: req.body.comment,
      user: req.user,
    });

    res.status(201).json({
      message: "Entrance comment created",
      house: result.house,
      entrance: result.entrance,
      comment: result.comment,
      id: result.id,
    });
  });

  /** GET /api-v1/nearby/:house_id/entrances/:entrance/comments */
  getEntranceComment = asyncHandler(async (req, res) => {
    const result = await this.getEntranceCommentUseCase.execute(
      req.params.house_id,
      req.params.entrance
    );

    res.json(result);
  });

  /** PUT /api-v1/nearby/entrance-comments/:comment_id */
  updateEntranceComment = asyncHandler(async (req, res) => {
    const updatedComment = await this.updateEntranceCommentUseCase.execute(
      parseInt(req.params.comment_id),
      validate(houseCommentBodySchema, req.body).comment,
      req.user.user_id
    );

    res.json(updatedComment);
  });

  /** DELETE /api-v1/nearby/entrance-comments/:comment_id */
  deleteEntranceComment = asyncHandler(async (req, res) => {
    await this.deleteEntranceCommentUseCase.execute(
      parseInt(req.params.comment_id),
      req.user.user_id
    );

    res.status(204).send();
  });

  /**
   * Последний текст комментария дома. Ключ может быть и id записи, и номером
   * дома — фронт присылает и то, и другое с разных экранов; раньше эта ветка
   * была скопирована в двух обработчиках.
   */
  async #latestHouseComment(houseKey) {
    if (!houseKey) {
      throw new ValidationError("House number is required");
    }

    if (isNaN(houseKey)) {
      return this.getHouseCommentsUseCase.executeSimple(houseKey);
    }

    const comments = await this.getHouseCommentsUseCase.execute(houseKey);

    return comments?.[0]?.comment ?? null;
  }
}
