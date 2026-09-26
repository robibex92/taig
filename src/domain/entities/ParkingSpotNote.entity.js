/**
 * ParkingSpotNote Entity
 * Служебная заметка администрации о парковочном месте.
 *
 * Отделяем от `description` места: описание видит покупатель, заметка —
 * внутренняя (кому жаловались, что обещали, нарушения).
 */
export class ParkingSpotNote {
  constructor({ id, spot_id, note, created_by_admin_id, created_at, updated_at }) {
    this.id = id;
    this.spot_id = spot_id;
    this.note = note;
    this.created_by_admin_id = created_by_admin_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new ParkingSpotNote({
      id: row.id,
      spot_id: row.spot_id,
      note: row.note,
      created_by_admin_id: row.created_by_admin_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  toJSON() {
    return {
      id: this.id,
      spot_id: this.spot_id,
      note: this.note,
      created_by_admin_id: this.created_by_admin_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
