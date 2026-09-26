import { IParkingSpotNoteRepository } from "../../domain/repositories/IParkingSpotNoteRepository.js";
import { ParkingSpotNote } from "../../domain/entities/ParkingSpotNote.entity.js";
import { prisma } from "../database/prisma.js";

/**
 * ParkingSpotNote Repository Implementation
 * Доступ к служебным заметкам о парковочных местах через Prisma.
 */
export class ParkingSpotNoteRepository extends IParkingSpotNoteRepository {
  async getBySpotId(spotId) {
    const rows = await prisma.parkingSpotNote.findMany({
      where: { spot_id: BigInt(spotId) },
      orderBy: { created_at: "desc" },
    });

    return rows.map((row) => ParkingSpotNote.fromDatabase(row));
  }

  async create(noteData) {
    const row = await prisma.parkingSpotNote.create({
      data: {
        spot_id: BigInt(noteData.spot_id),
        note: noteData.note,
        created_by_admin_id: BigInt(noteData.created_by_admin_id),
      },
    });

    return ParkingSpotNote.fromDatabase(row);
  }

  async deleteById(noteId) {
    const deleted = await prisma.parkingSpotNote.deleteMany({
      where: { id: BigInt(noteId) },
    });

    return deleted.count > 0;
  }
}
