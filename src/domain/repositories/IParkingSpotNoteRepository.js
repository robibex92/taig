/**
 * ParkingSpotNote Repository Interface
 * Контракт доступа к служебным заметкам администрации о месте.
 */
export class IParkingSpotNoteRepository {
  /** @returns {Promise<ParkingSpotNote[]>} новые сверху */
  async getBySpotId(spotId) {
    throw new Error("Method not implemented");
  }

  /** @returns {Promise<ParkingSpotNote>} */
  async create(noteData) {
    throw new Error("Method not implemented");
  }

  /** @returns {Promise<boolean>} false — заметки с таким id не было */
  async deleteById(noteId) {
    throw new Error("Method not implemented");
  }
}
