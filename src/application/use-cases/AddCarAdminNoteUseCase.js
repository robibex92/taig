import { AppError } from "../../core/errors/AppError.js";

/**
 * Add Car Admin Note Use Case
 * Adds a new admin note about car ownership (admin only)
 */
export class AddCarAdminNoteUseCase {
  constructor(carAdminNoteRepository, carRepository) {
    this.carAdminNoteRepository = carAdminNoteRepository;
    this.carRepository = carRepository;
  }

  async execute(carId, noteData, adminId) {
    // Check if car exists
    const car = await this.carRepository.getById(carId);
    if (!car) {
      throw new AppError("Car not found", 404);
    }

    // Validate required fields
    if (!noteData.note || noteData.note.trim().length === 0) {
      throw new AppError("Note content is required", 400);
    }

    // Create the admin note
    const adminNote = await this.carAdminNoteRepository.create({
      car_id: carId,
      note: noteData.note.trim(),
      created_by_admin_id: adminId,
    });

    return adminNote.toJSON();
  }
}
