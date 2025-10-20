import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  getEntrancesSchema,
  getHousesFilterSchema,
  userIdParamSchema,
  houseIdParamSchema,
  linkUserToApartmentSchema,
  unlinkUserFromApartmentSchema,
} from "../../core/validation/schemas/house.schema.js";

/**
 * House Controller
 * Handles HTTP requests for house/apartment operations
 */
export class HouseController {
  constructor(
    getUniqueHousesUseCase,
    getEntrancesByHouseUseCase,
    getHousesByFilterUseCase,
    getUserHousesUseCase,
    getHouseInfoUseCase,
    linkUserToApartmentUseCase,
    unlinkUserFromApartmentUseCase,
    updateHouseInfoUseCase,
    // Comment use cases
    createHouseCommentUseCase,
    getHouseCommentsUseCase,
    updateHouseCommentUseCase,
    deleteHouseCommentUseCase,
    createEntranceCommentUseCase,
    getEntranceCommentsUseCase,
    updateEntranceCommentUseCase,
    deleteEntranceCommentUseCase
  ) {
    this.getUniqueHousesUseCase = getUniqueHousesUseCase;
    this.getEntrancesByHouseUseCase = getEntrancesByHouseUseCase;
    this.getHousesByFilterUseCase = getHousesByFilterUseCase;
    this.getUserHousesUseCase = getUserHousesUseCase;
    this.getHouseInfoUseCase = getHouseInfoUseCase;
    this.linkUserToApartmentUseCase = linkUserToApartmentUseCase;
    this.unlinkUserFromApartmentUseCase = unlinkUserFromApartmentUseCase;
    this.updateHouseInfoUseCase = updateHouseInfoUseCase;

    // Comment use cases
    this.createHouseCommentUseCase = createHouseCommentUseCase;
    this.getHouseCommentsUseCase = getHouseCommentsUseCase;
    this.updateHouseCommentUseCase = updateHouseCommentUseCase;
    this.deleteHouseCommentUseCase = deleteHouseCommentUseCase;
    this.createEntranceCommentUseCase = createEntranceCommentUseCase;
    this.getEntranceCommentsUseCase = getEntranceCommentsUseCase;
    this.updateEntranceCommentUseCase = updateEntranceCommentUseCase;
    this.deleteEntranceCommentUseCase = deleteEntranceCommentUseCase;
  }

  /**
   * GET /api-v1/nearby/houses
   * Get all unique houses
   */
  getUniqueHouses = asyncHandler(async (req, res) => {
    const houses = await this.getUniqueHousesUseCase.execute();

    res.json({
      data: houses,
    });
  });

  /**
   * GET /api-v1/nearby/entrances
   * Get entrances for a specific house
   */
  getEntrances = asyncHandler(async (req, res) => {
    const { error } = getEntrancesSchema.validate(req.query);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { house } = req.query;
    const entrances = await this.getEntrancesByHouseUseCase.execute(house);

    res.json({
      data: entrances,
    });
  });

  /**
   * GET /api-v1/nearby
   * Get houses by filter (house, entrance, position)
   */
  getHousesByFilter = asyncHandler(async (req, res) => {
    const { error } = getHousesFilterSchema.validate(req.query);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { house, entrance, position } = req.query;
    const houses = await this.getHousesByFilterUseCase.execute({
      house,
      entrance: entrance ? parseInt(entrance) : undefined,
      position: position ? parseInt(position) : undefined,
    });

    res.json({
      data: houses,
    });
  });

  /**
   * GET /api-v1/nearby/user/:id_telegram
   * Get all houses for a user
   */
  getUserHouses = asyncHandler(async (req, res) => {
    const { error } = userIdParamSchema.validate({
      id_telegram: parseInt(req.params.id_telegram),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const houses = await this.getUserHousesUseCase.execute(
      parseInt(req.params.id_telegram)
    );

    res.json({
      data: houses,
    });
  });

  /**
   * GET /api-v1/nearby/:id/info
   * Get info for a specific house
   */
  getHouseInfo = asyncHandler(async (req, res) => {
    const { error } = houseIdParamSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const info = await this.getHouseInfoUseCase.execute(
      parseInt(req.params.id)
    );

    res.json({
      info,
    });
  });

  /**
   * POST /api-v1/nearby
   * Link user to apartment (create or update position)
   */
  linkUserToApartment = asyncHandler(async (req, res) => {
    const { error } = linkUserToApartmentSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { house, entrance, number, id_telegram } = req.body;
    const result = await this.linkUserToApartmentUseCase.execute(
      house,
      entrance,
      number,
      id_telegram
    );

    const statusCode = result.message.includes("Created") ? 201 : 200;

    res.status(statusCode).json(result);
  });

  /**
   * POST /api-v1/nearby/unlink
   * Unlink user from apartment
   */
  unlinkUserFromApartment = asyncHandler(async (req, res) => {
    const { error } = unlinkUserFromApartmentSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { id, id_telegram } = req.body;
    const result = await this.unlinkUserFromApartmentUseCase.execute(
      id,
      id_telegram
    );

    res.json(result);
  });

  /**
   * PATCH /api-v1/nearby/:id/info
   * Update house info (admin only)
   */
  updateHouseInfo = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { info } = req.body;
    const user = req.user;

    const updatedHouse = await this.updateHouseInfoUseCase.execute(
      parseInt(id),
      info,
      user
    );

    res.json({
      success: true,
      data: updatedHouse.toJSON(),
      message: "House info updated successfully",
    });
  });

  // ================== HOUSE COMMENTS ==================

  /**
   * POST /api-v1/nearby/:house_id/comments
   * Create house comment (admin only)
   */
  createHouseComment = asyncHandler(async (req, res) => {
    const { house_id } = req.params;
    const { comment } = req.body;
    const user = req.user;

    const newComment = await this.createHouseCommentUseCase.execute({
      house_id: parseInt(house_id),
      author_id: user.user_id,
      comment,
    });

    res.status(201).json(newComment);
  });

  /**
   * GET /api-v1/nearby/:house_id/comments
   * Get house comments
   */
  getHouseComments = asyncHandler(async (req, res) => {
    const { house_id } = req.params;

    const comments = await this.getHouseCommentsUseCase.execute(
      parseInt(house_id)
    );

    res.json(comments);
  });

  /**
   * PUT /api-v1/nearby/comments/:comment_id
   * Update house comment (admin only)
   */
  updateHouseComment = asyncHandler(async (req, res) => {
    const { comment_id } = req.params;
    const { comment } = req.body;
    const user = req.user;

    const updatedComment = await this.updateHouseCommentUseCase.execute(
      parseInt(comment_id),
      comment,
      user.user_id
    );

    res.json(updatedComment);
  });

  /**
   * DELETE /api-v1/nearby/comments/:comment_id
   * Delete house comment (admin only)
   */
  deleteHouseComment = asyncHandler(async (req, res) => {
    const { comment_id } = req.params;
    const user = req.user;

    await this.deleteHouseCommentUseCase.execute(
      parseInt(comment_id),
      user.user_id
    );

    res.status(204).send();
  });

  // ================== ENTRANCE COMMENTS ==================

  /**
   * POST /api-v1/nearby/:house_id/entrances/:entrance/comments
   * Create entrance comment (admin only)
   */
  createEntranceComment = asyncHandler(async (req, res) => {
    const { house_id, entrance } = req.params;
    const { comment } = req.body;
    const user = req.user;

    const newComment = await this.createEntranceCommentUseCase.execute({
      house_id: parseInt(house_id),
      entrance: parseInt(entrance),
      author_id: user.user_id,
      comment,
    });

    res.status(201).json(newComment);
  });

  /**
   * GET /api-v1/nearby/:house_id/entrances/:entrance/comments
   * Get entrance comment
   */
  getEntranceComment = asyncHandler(async (req, res) => {
    const { house_id, entrance } = req.params;

    const comment = await this.getEntranceCommentsUseCase.execute(
      parseInt(house_id),
      parseInt(entrance)
    );

    res.json(comment);
  });

  /**
   * PUT /api-v1/nearby/entrance-comments/:comment_id
   * Update entrance comment (admin only)
   */
  updateEntranceComment = asyncHandler(async (req, res) => {
    const { comment_id } = req.params;
    const { comment } = req.body;
    const user = req.user;

    const updatedComment = await this.updateEntranceCommentUseCase.execute(
      parseInt(comment_id),
      comment,
      user.user_id
    );

    res.json(updatedComment);
  });

  /**
   * DELETE /api-v1/nearby/entrance-comments/:comment_id
   * Delete entrance comment (admin only)
   */
  deleteEntranceComment = asyncHandler(async (req, res) => {
    const { comment_id } = req.params;
    const user = req.user;

    await this.deleteEntranceCommentUseCase.execute(
      parseInt(comment_id),
      user.user_id
    );

    res.status(204).send();
  });
}
