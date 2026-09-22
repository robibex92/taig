import { logger } from "../../../core/utils/logger.js";
import { loadManageableCar } from "./carAccess.js";

/**
 * Use case for soft deleting a car
 */
export class DeleteCarUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId, user) {
    await loadManageableCar(this.carRepository, carId, user, "delete");

    const deleted = await this.carRepository.softDelete(carId);

    if (deleted) {
      logger.info("Car soft deleted", { car_id: carId, by: user?.user_id });
    }

    return deleted;
  }
}
