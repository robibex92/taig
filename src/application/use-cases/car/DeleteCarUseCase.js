import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for soft deleting a car
 */
export class DeleteCarUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId) {
    // Check if car exists
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new NotFoundError("Car");
    }

    // Soft delete
    const deleted = await this.carRepository.softDelete(carId);

    if (deleted) {
      logger.info("Car soft deleted", { car_id: carId });
    }

    return deleted;
  }
}
