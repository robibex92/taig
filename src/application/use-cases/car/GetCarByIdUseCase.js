import { projectCarForViewer } from "./carAccess.js";

/**
 * Use case for getting car by ID
 */
export class GetCarByIdUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId, viewer = null) {
    const car = await this.carRepository.findById(carId);

    return projectCarForViewer(car, viewer);
  }
}
