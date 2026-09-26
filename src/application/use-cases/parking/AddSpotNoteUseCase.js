import { loadSpot } from "./parkingAccess.js";
import { authorLabel, requireStaffViewer, toNoteResponse } from "./spotNotesShared.js";

export class AddSpotNoteUseCase {
  constructor(spotNoteRepository) {
    this.spotNoteRepository = spotNoteRepository;
  }

  async execute(spotId, note, user) {
    requireStaffViewer(user);

    const spot = await loadSpot(spotId);

    const created = await this.spotNoteRepository.create({
      spot_id: spot.id,
      note,
      created_by_admin_id: user.user_id,
    });

    return toNoteResponse(created, authorLabel(user, user.user_id));
  }
}
