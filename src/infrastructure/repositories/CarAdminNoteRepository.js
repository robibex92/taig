import { ICarAdminNoteRepository } from "../../domain/repositories/ICarAdminNoteRepository.js";
import { CarAdminNote } from "../../domain/entities/CarAdminNote.entity.js";
import { prisma } from "../database/prisma.js";

/**
 * CarAdminNote Repository Implementation
 * Handles car admin note data access using Prisma
 */
export class CarAdminNoteRepository extends ICarAdminNoteRepository {
  /**
   * Get all admin notes for a specific car
   */
  async getByCarId(carId) {
    try {
      const rows = await prisma.carAdminNote.findMany({
        where: { car_id: BigInt(carId) },
        orderBy: { created_at: "desc" },
      });

      return rows.map((row) => CarAdminNote.fromDatabase(row));
    } catch (error) {
      console.error("Error in CarAdminNoteRepository.getByCarId:", error);
      throw error;
    }
  }

  /**
   * Get admin note by ID
   */
  async getById(id) {
    const row = await prisma.carAdminNote.findUnique({
      where: { id: BigInt(id) },
    });

    return CarAdminNote.fromDatabase(row);
  }

  /**
   * Create new admin note
   */
  async create(noteData) {
    const row = await prisma.carAdminNote.create({
      data: {
        car_id: BigInt(noteData.car_id),
        note: noteData.note,
        created_by_admin_id: BigInt(noteData.created_by_admin_id),
      },
    });

    return CarAdminNote.fromDatabase(row);
  }

  /**
   * Update admin note
   */
  async update(id, updateData) {
    const row = await prisma.carAdminNote.update({
      where: { id: BigInt(id) },
      data: {
        ...(updateData.note !== undefined && { note: updateData.note }),
      },
    });

    return CarAdminNote.fromDatabase(row);
  }

  /**
   * Delete admin note
   */
  async delete(id) {
    await prisma.carAdminNote.delete({
      where: { id: BigInt(id) },
    });

    return true;
  }

  /**
   * Delete all admin notes for a car (when car gets assigned to user)
   */
  async deleteByCarId(carId) {
    await prisma.carAdminNote.deleteMany({
      where: { car_id: BigInt(carId) },
    });

    return true;
  }
}
