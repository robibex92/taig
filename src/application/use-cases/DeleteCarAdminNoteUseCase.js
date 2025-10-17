import { AppError } from "../../core/errors/AppError.js";

/**
 * Delete Car Admin Note Use Case
 * Deletes an admin note (admin only)
 */
export class DeleteCarAdminNoteUseCase {
  constructor(carAdminNoteRepository) {
    this.carAdminNoteRepository = carAdminNoteRepository;
  }

  async execute(noteId) {
    // Check if note exists
    const existingNote = await this.carAdminNoteRepository.getById(noteId);
    if (!existingNote) {
      throw new AppError("Admin note not found", 404);
    }

    // Delete the note
    await this.carAdminNoteRepository.delete(noteId);

    return { success: true, message: "Admin note deleted successfully" };
  }
}
