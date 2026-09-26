import { NotFoundError } from "../../../core/errors/AppError.js";
import { requireStaffViewer } from "./spotNotesShared.js";

export class DeleteSpotNoteUseCase {
  constructor(spotNoteRepository) {
    this.spotNoteRepository = spotNoteRepository;
  }

  async execute(noteId, user) {
    requireStaffViewer(user);

    const deleted = await this.spotNoteRepository.deleteById(noteId);
    if (!deleted) {
      throw new NotFoundError("Note");
    }

    return { message: "Заметка удалена" };
  }
}
