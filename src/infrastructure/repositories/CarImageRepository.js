import { ICarImageRepository } from "../../domain/repositories/ICarImageRepository.js";
import { CarImage } from "../../domain/entities/CarImage.entity.js";
import { prisma } from "../database/prisma.js";

/**
 * CarImage Repository Implementation
 * Handles car image data access using Prisma
 */
export class CarImageRepository extends ICarImageRepository {
  /**
   * Get all images for a specific car
   */
  async getByCarId(carId) {
    const rows = await prisma.carImage.findMany({
      where: { car_id: carId },
      orderBy: { created_at: "desc" },
    });

    return rows.map((row) => CarImage.fromDatabase(row));
  }

  /**
   * Get image by ID
   */
  async getById(id) {
    const row = await prisma.carImage.findUnique({
      where: { id: BigInt(id) },
    });

    return CarImage.fromDatabase(row);
  }

  /**
   * Create new car image
   */
  async create(imageData) {
    const row = await prisma.carImage.create({
      data: {
        car_id: BigInt(imageData.car_id),
        image_url: imageData.image_url,
        comment: imageData.comment,
        added_by_user_id: imageData.added_by_user_id
          ? BigInt(imageData.added_by_user_id)
          : null,
      },
    });

    return CarImage.fromDatabase(row);
  }

  /**
   * Update car image
   */
  async update(id, updateData) {
    const row = await prisma.carImage.update({
      where: { id: BigInt(id) },
      data: {
        ...(updateData.comment !== undefined && {
          comment: updateData.comment,
        }),
        ...(updateData.image_url !== undefined && {
          image_url: updateData.image_url,
        }),
      },
    });

    return CarImage.fromDatabase(row);
  }

  /**
   * Delete car image
   */
  async delete(id) {
    await prisma.carImage.delete({
      where: { id: BigInt(id) },
    });

    return true;
  }

  /**
   * Get images with pagination
   */
  async getByCarIdWithPagination(carId, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.carImage.findMany({
        where: { car_id: carId },
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.carImage.count({
        where: { car_id: carId },
      }),
    ]);

    return {
      images: rows.map((row) => CarImage.fromDatabase(row)),
      total,
    };
  }
}
