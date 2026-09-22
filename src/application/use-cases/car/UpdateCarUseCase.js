import {
  loadManageableCar,
  withoutAdminOnlyFields,
} from "./carAccess.js";

/**
 * Use case for updating car
 */
export class UpdateCarUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId, updateData, user) {
    await loadManageableCar(this.carRepository, carId, user, "edit");

    return await this.carRepository.update(
      carId,
      withoutAdminOnlyFields(updateData, user)
    );
  }
}
