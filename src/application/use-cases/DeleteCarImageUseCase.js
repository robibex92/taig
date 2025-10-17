import { AppError } from "../../core/errors/AppError.js";

/**
 * Delete Car Image Use Case
 * Deletes a car image from the gallery
 */
export class DeleteCarImageUseCase {
  constructor(carImageRepository) {
    this.carImageRepository = carImageRepository;
  }

  async execute(imageId) {
    // Check if image exists
    const existingImage = await this.carImageRepository.getById(imageId);
    if (!existingImage) {
      throw new AppError("Car image not found", 404);
    }

    // Delete the image
    await this.carImageRepository.delete(imageId);

    return { success: true, message: "Car image deleted successfully" };
  }
}
