import { AppError } from "../../core/errors/AppError.js";

/**
 * Get Car Admin Notes Use Case
 * Retrieves admin notes for a specific car (admin only)
 */
export class GetCarAdminNotesUseCase {
  constructor(carAdminNoteRepository, carRepository) {
    this.carAdminNoteRepository = carAdminNoteRepository;
    this.carRepository = carRepository;
  }

  async execute(carId) {
    try {
      // Check if car exists
      const car = await this.carRepository.findById(carId);
      if (!car) {
        throw new AppError("Car not found", 404);
      }

      // Get all admin notes for the car
      const notes = await this.carAdminNoteRepository.getByCarId(carId);

      return notes.map((note) => note.toJSON());
    } catch (error) {
      console.error("Error in GetCarAdminNotesUseCase:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to retrieve admin notes", 500);
    }
  }
}
