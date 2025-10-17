import { AppError } from "../../core/errors/AppError.js";

/**
 * Merge Cars Use Case
 * Merges two cars with the same car number when a user registers
 */
export class MergeCarsUseCase {
  constructor(carRepository, carImageRepository, carAdminNoteRepository) {
    this.carRepository = carRepository;
    this.carImageRepository = carImageRepository;
    this.carAdminNoteRepository = carAdminNoteRepository;
  }

  async execute(carId1, carId2, mergeOptions = {}) {
    // Get both cars
    const car1 = await this.carRepository.findById(carId1);
    const car2 = await this.carRepository.findById(carId2);

    if (!car1 || !car2) {
      throw new AppError("One or both cars not found", 404);
    }

    // Check if cars have the same number
    if (car1.car_number !== car2.car_number) {
      throw new AppError("Cars must have the same number to be merged", 400);
    }

    // Determine which car to keep (the one with user_id if any)
    let carToKeep, carToMerge;
    if (car1.user_id && !car2.user_id) {
      carToKeep = car1;
      carToMerge = car2;
    } else if (!car1.user_id && car2.user_id) {
      carToKeep = car2;
      carToMerge = car1;
    } else {
      // Both have users or both don't - keep the first one
      carToKeep = car1;
      carToMerge = car2;
    }

    // Merge data based on options
    const mergedData = this.mergeCarData(carToKeep, carToMerge, mergeOptions);

    // Start transaction to merge cars
    const result = await this.performMerge(
      carToKeep.id,
      carToMerge.id,
      mergedData
    );

    return result;
  }

  mergeCarData(car1, car2, options) {
    const merged = {};

    // Merge each field based on options or default logic
    merged.car_brand = options.car_brand || car1.car_brand || car2.car_brand;
    merged.car_model = options.car_model || car1.car_model || car2.car_model;
    merged.car_color = options.car_color || car1.car_color || car2.car_color;
    merged.info = options.info || car1.info || car2.info;
    merged.status =
      options.status !== undefined
        ? options.status
        : car1.status && car2.status;

    // Keep the user_id from the car that has it
    merged.user_id = car1.user_id || car2.user_id;

    return merged;
  }

  async performMerge(carToKeepId, carToMergeId, mergedData) {
    // Update the car to keep with merged data
    const updatedCar = await this.carRepository.update(carToKeepId, mergedData);

    // Move all images from car to merge to car to keep
    const imagesToMove = await this.carImageRepository.getByCarId(carToMergeId);
    for (const image of imagesToMove) {
      await this.carImageRepository.update(image.id, { car_id: carToKeepId });
    }

    // Delete admin notes from the car to merge (they're no longer needed)
    await this.carAdminNoteRepository.deleteByCarId(carToMergeId);

    // Delete the car to merge
    await this.carRepository.delete(carToMergeId);

    return {
      success: true,
      message: "Cars merged successfully",
      data: updatedCar.toJSON(),
      mergedCarId: carToMergeId,
    };
  }
}
