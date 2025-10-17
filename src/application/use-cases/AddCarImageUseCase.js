import { AppError } from "../../core/errors/AppError.js";

/**
 * Add Car Image Use Case
 * Adds a new image to a car's gallery
 */
export class AddCarImageUseCase {
  constructor(carImageRepository, carRepository) {
    this.carImageRepository = carImageRepository;
    this.carRepository = carRepository;
  }

  async execute(carId, imageData, userId = null) {
    // Check if car exists
    const car = await this.carRepository.getById(carId);
    if (!car) {
      throw new AppError("Car not found", 404);
    }

    // Validate required fields
    if (!imageData.image_url) {
      throw new AppError("Image URL is required", 400);
    }

    // Create the car image
    const carImage = await this.carImageRepository.create({
      car_id: carId,
      image_url: imageData.image_url,
      comment: imageData.comment || null,
      added_by_user_id: userId,
    });

    return carImage.toJSON();
  }
}
