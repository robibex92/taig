import { AppError, AuthorizationError } from "../../core/errors/AppError.js";
import { isCarsAdmin } from "../../core/utils/roles.js";

/**
 * Get Car Images Use Case
 * The gallery is editorial content: only car administrators may read it.
 * Single exception — the owner of the car may see the photos of their own car.
 */
export class GetCarImagesUseCase {
  constructor(carImageRepository, carRepository) {
    this.carImageRepository = carImageRepository;
    this.carRepository = carRepository;
  }

  async execute(carId, viewer = null) {
    // Check if car exists
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new AppError("Car not found", 404);
    }

    const isOwner =
      viewer?.user_id != null && String(car.user_id) === String(viewer.user_id);

    if (!isCarsAdmin(viewer) && !isOwner) {
      throw new AuthorizationError(
        "Галерея автомобиля доступна только администратору автомобилей"
      );
    }

    const images = await this.carImageRepository.getByCarId(carId);

    return images.map((image) => image.toJSON());
  }
}
