import { AppError } from "../../core/errors/AppError.js";

/**
 * Update Car Admin Note Use Case
 * Updates an existing admin note (admin only)
 */
export class UpdateCarAdminNoteUseCase {
  constructor(carAdminNoteRepository) {
    this.carAdminNoteRepository = carAdminNoteRepository;
  }

  async execute(noteId, updateData) {
    // Check if note exists
    const existingNote = await this.carAdminNoteRepository.getById(noteId);
    if (!existingNote) {
      throw new AppError("Admin note not found", 404);
    }

    // Update the note
    const updatedNote = await this.carAdminNoteRepository.update(
      noteId,
      updateData
    );

    return updatedNote.toJSON();
  }
}
