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

    const { house, number, id_telegram } = req.body;
    const result = await this.linkUserToApartmentUseCase.execute(
      house,
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
      house_id: house_id, // Pass as string to support both house_id and house number
      author_id: user.user_id,
      comment,
    });

    res.status(201).json(newComment);
  });

  /**
   * POST /api-v1/nearby/comments
   * Create house comment by house number (admin only)
   */
  createHouseCommentByNumber = asyncHandler(async (req, res) => {
    const { house, comment } = req.body;
    const user = req.user;

    if (!house) {
      return res.status(400).json({ error: "House number is required" });
    }

    const newComment = await this.createHouseCommentUseCase.execute({
      house_id: house, // Pass house number as string
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

    const comments = await this.getHouseCommentsUseCase.execute(house_id);

    res.json(comments);
  });

  /**
   * GET /api-v1/nearby/:house_id/comment
   * Get simplified house comment (only comment text)
   */
  getHouseComment = asyncHandler(async (req, res) => {
    const { house_id } = req.params;

    // Если это число, используем обычный метод
    if (!isNaN(house_id)) {
      const comments = await this.getHouseCommentsUseCase.execute(house_id);
      if (comments && comments.length > 0 && comments[0].comment) {
        res.json({ comment: comments[0].comment });
      } else {
        res.json(null);
      }
    } else {
      // Если это строка (номер дома), используем упрощенный метод
      const comment = await this.getHouseCommentsUseCase.executeSimple(
        house_id
      );
      if (comment) {
        res.json({ comment });
      } else {
        res.json(null);
      }
    }
  });

  /**
   * GET /api-v1/nearby/comments?house=HOUSE_NUMBER
   * Get house comments by house number (query param)
   */
  getHouseCommentsByNumber = asyncHandler(async (req, res) => {
    const { house } = req.query;

    console.log(`getHouseCommentsByNumber called with house: "${house}"`);

    if (!house) {
      return res.status(400).json({ error: "House number is required" });
    }

    try {
      const comments = await this.getHouseCommentsUseCase.execute(house);
      res.json(comments);
    } catch (error) {
      console.error("Error in getHouseCommentsByNumber:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api-v1/nearby/comment?house=HOUSE_NUMBER
   * Get simplified house comment by house number (query param)
   */
  getHouseCommentByNumber = asyncHandler(async (req, res) => {
    const { house } = req.query;

    console.log(`Getting comment for house: "${house}"`);

    if (!house) {
      return res.status(400).json({ error: "House number is required" });
    }

    try {
      // Используем упрощенный метод для получения только текста комментария
      const comment = await this.getHouseCommentsUseCase.executeSimple(house);

      console.log(`Comment found: ${comment ? `"${comment}"` : "null"}`);

      if (comment) {
        res.json({ comment });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error in getHouseCommentByNumber:", error);
      res.status(500).json({ error: "Internal server error" });
    }
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
      house_id: house_id,
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
      house_id,
      parseInt(entrance)
    );

    // Если комментарий не найден, возвращаем null
    res.json(comment);
  });

  /**
   * GET /api-v1/nearby/:house_id/entrances/:entrance/comment
   * Get simplified entrance comment (only comment text)
   */
  getEntranceCommentSimple = asyncHandler(async (req, res) => {
    const { house_id, entrance } = req.params;

    console.log(
      `getEntranceCommentSimple called with house_id=${house_id}, entrance=${entrance}`
    );

    try {
      // Если house_id это число, используем обычный метод
      if (!isNaN(house_id)) {
        const comment = await this.getEntranceCommentsUseCase.execute(
          parseInt(house_id),
          parseInt(entrance)
        );

        console.log(`getEntranceCommentSimple result:`, comment);

        if (comment && comment.comment) {
          res.json({ comment: comment.comment });
        } else {
          res.json(null);
        }
      } else {
        // Если это строка (номер дома), используем упрощенный метод
        const comment = await this.getEntranceCommentsUseCase.executeSimple(
          house_id,
          parseInt(entrance)
        );

        console.log(`getEntranceCommentSimple result:`, comment);

        if (comment) {
          res.json({ comment });
        } else {
          res.json(null);
        }
      }
    } catch (error) {
      console.error("Error in getEntranceCommentSimple:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
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
