import { logger } from "../../../core/utils/logger.js";
import { isCarsAdmin } from "../../../core/utils/roles.js";

/**
 * Use case for creating a car
 */
export class CreateCarUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carData, user) {
    // Residents register their own car; only a cars admin may register one for somebody else
    const owner_id = isCarsAdmin(user) ? carData.user_id : user?.user_id;

    const car = await this.carRepository.create({ ...carData, user_id: owner_id });

    logger.info("Car created", {
      car_id: car.id,
      user_id: car.user_id,
      car_number: car.car_number,
    });

    return car;
  }
}
