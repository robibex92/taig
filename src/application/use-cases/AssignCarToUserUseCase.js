import { AppError } from "../../core/errors/AppError.js";

/**
 * Assign Car to User Use Case
 * Assigns an unassigned car to a user (admin only)
 */
export class AssignCarToUserUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId, userId) {
    // Check if car exists
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new AppError("Car not found", 404);
    }

    // Check if car is already assigned
    if (car.user_id) {
      throw new AppError("Car is already assigned to a user", 400);
    }

    // Update car with user assignment
    const updatedCar = await this.carRepository.update(carId, {
      user_id: userId,
    });

    // Admin notes stay: they describe the car (violations, agreements, history),
    // not the fact that it had no owner yet.

    return {
      success: true,
      message: "Car assigned to user successfully",
      data: updatedCar.toJSON(),
    };
  }
}
