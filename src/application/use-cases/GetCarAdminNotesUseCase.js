import { AppError } from "../../core/errors/AppError.js";

/**
 * Get Car Admin Notes Use Case
 * Retrieves admin notes for a specific car (admin only)
 */
export class GetCarAdminNotesUseCase {
  constructor(carAdminNoteRepository, carRepository, userRepository) {
    this.carAdminNoteRepository = carAdminNoteRepository;
    this.carRepository = carRepository;
    this.userRepository = userRepository;
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
      const authors = await this.resolveAuthors(
        notes.map((note) => note.created_by_admin_id)
      );

      return notes.map((note) => ({
        ...note.toJSON(),
        created_by_label:
          authors.get(String(note.created_by_admin_id)) ?? null,
      }));
    } catch (error) {
      console.error("Error in GetCarAdminNotesUseCase:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to retrieve admin notes", 500);
    }
  }

  /**
   * Подпись автора — тот же порядок, что в подборе владельца в админке:
   * @username, затем имя, иначе null (фронт покажет «ID …»).
   */
  async resolveAuthors(adminIds) {
    const unique = [...new Set(adminIds.map((id) => String(id)))];

    const resolved = await Promise.all(
      unique.map(async (id) => {
        const user = await this.userRepository.findById(id);
        const label = user
          ? user.username
            ? `@${user.username}`
            : user.first_name || null
          : null;
        return [id, label];
      })
    );

    return new Map(resolved);
  }
}
