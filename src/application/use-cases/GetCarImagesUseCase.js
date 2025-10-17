import { AppError } from "../../core/errors/AppError.js";

/**
 * Get Car Images Use Case
 * Retrieves all images for a specific car
 */
export class GetCarImagesUseCase {
  constructor(carImageRepository, carRepository) {
    this.carImageRepository = carImageRepository;
    this.carRepository = carRepository;
  }

  async execute(carId, isAdmin = false) {
    // Check if car exists
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new AppError("Car not found", 404);
    }

    // Get all images for the car
    const images = await this.carImageRepository.getByCarId(carId);

    // Return images with appropriate visibility based on user role
    return images.map((image) => image.toJSONForUser(isAdmin));
  }
}
