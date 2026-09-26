import { loadSpot } from "./parkingAccess.js";
import { authorLabel, requireStaffViewer, toNoteResponse } from "./spotNotesShared.js";

/** Служебные заметки администрации о парковочном месте. */
export class GetSpotNotesUseCase {
  constructor(spotNoteRepository, userRepository) {
    this.spotNoteRepository = spotNoteRepository;
    this.userRepository = userRepository;
  }

  async execute(spotId, user) {
    requireStaffViewer(user);

    const spot = await loadSpot(spotId);
    const notes = await this.spotNoteRepository.getBySpotId(spot.id);
    const authors = await this.userRepository.findByIds(
      notes.map((note) => note.created_by_admin_id)
    );
    const byId = new Map(authors.map((author) => [String(author.user_id), author]));

    return notes.map((note) =>
      toNoteResponse(
        note,
        authorLabel(byId.get(String(note.created_by_admin_id)), note.created_by_admin_id)
      )
    );
  }
}
