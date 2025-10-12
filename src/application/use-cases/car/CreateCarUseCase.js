import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for creating a car
 */
export class CreateCarUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carData) {
    const car = await this.carRepository.create(carData);

    logger.info("Car created", {
      car_id: car.id,
      user_id: car.user_id,
      car_number: car.car_number,
    });

    return car;
  }
}
