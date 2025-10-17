import { AppError } from "../../core/errors/AppError.js";

/**
 * Update Car Image Use Case
 * Updates an existing car image (mainly for comments)
 */
export class UpdateCarImageUseCase {
  constructor(carImageRepository) {
    this.carImageRepository = carImageRepository;
  }

  async execute(imageId, updateData) {
    // Check if image exists
    const existingImage = await this.carImageRepository.getById(imageId);
    if (!existingImage) {
      throw new AppError("Car image not found", 404);
    }

    // Update the image
    const updatedImage = await this.carImageRepository.update(
      imageId,
      updateData
    );

    return updatedImage.toJSON();
  }
}
