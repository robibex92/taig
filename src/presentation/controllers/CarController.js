import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  createCarSchema,
  getUserIdSchema,
  carIdSchema,
} from "../../core/validation/schemas/car.schema.js";

/**
 * Car Controller
 * Handles HTTP requests for car operations
 */
export class CarController {
  constructor(
    getCarsUseCase,
    getUserCarsUseCase,
    createCarUseCase,
    deleteCarUseCase
  ) {
    this.getCarsUseCase = getCarsUseCase;
    this.getUserCarsUseCase = getUserCarsUseCase;
    this.createCarUseCase = createCarUseCase;
    this.deleteCarUseCase = deleteCarUseCase;
  }

  /**
   * GET /api/v1/cars
   * Get all active cars
   */
  getAll = asyncHandler(async (req, res) => {
    const cars = await this.getCarsUseCase.execute();

    res.json({
      success: true,
      data: cars,
    });
  });

  /**
   * GET /api/v1/cars/user/:user_id
   * Get cars by user ID
   */
  getUserCars = asyncHandler(async (req, res) => {
    const { error } = getUserIdSchema.validate({
      user_id: parseInt(req.params.user_id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const cars = await this.getUserCarsUseCase.execute(
      parseInt(req.params.user_id)
    );

    res.json({
      success: true,
      data: cars,
    });
  });

  /**
   * POST /api/v1/cars
   * Create new car
   */
  create = asyncHandler(async (req, res) => {
    const { error } = createCarSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const car = await this.createCarUseCase.execute(req.body);

    res.status(201).json({
      success: true,
      data: car,
    });
  });

  /**
   * DELETE /api/v1/cars/:id
   * Soft delete car
   */
  delete = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    await this.deleteCarUseCase.execute(parseInt(req.params.id));

    res.status(204).send();
  });
}
