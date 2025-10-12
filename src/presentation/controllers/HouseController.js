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
    unlinkUserFromApartmentUseCase
  ) {
    this.getUniqueHousesUseCase = getUniqueHousesUseCase;
    this.getEntrancesByHouseUseCase = getEntrancesByHouseUseCase;
    this.getHousesByFilterUseCase = getHousesByFilterUseCase;
    this.getUserHousesUseCase = getUserHousesUseCase;
    this.getHouseInfoUseCase = getHouseInfoUseCase;
    this.linkUserToApartmentUseCase = linkUserToApartmentUseCase;
    this.unlinkUserFromApartmentUseCase = unlinkUserFromApartmentUseCase;
  }

  /**
   * GET /api/v1/nearby/houses
   * Get all unique houses
   */
  getUniqueHouses = asyncHandler(async (req, res) => {
    const houses = await this.getUniqueHousesUseCase.execute();

    res.json({
      data: houses,
    });
  });

  /**
   * GET /api/v1/nearby/entrances
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
   * GET /api/v1/nearby
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
   * GET /api/v1/nearby/user/:id_telegram
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
   * GET /api/v1/nearby/:id/info
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
   * POST /api/v1/nearby
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
   * POST /api/v1/nearby/unlink
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
}
