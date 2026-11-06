import { projectCarForViewer } from "./carAccess.js";

/**
 * Use case for getting all cars
 *
 * Список публичный, но не строка целиком: чьё это авто, знает только администратор
 * автомобилей и сам владелец (`projectCarForViewer`).
 */
export class GetCarsUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(viewer = null) {
    const cars = await this.carRepository.findAll();

    return cars.map((car) => projectCarForViewer(car, viewer));
  }
}
