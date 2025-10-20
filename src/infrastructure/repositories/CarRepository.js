import { prisma } from "../database/prisma.js";
import { ICarRepository } from "../../domain/repositories/ICarRepository.js";
import { Car } from "../../domain/entities/Car.entity.js";

/**
 * Car Repository Implementation with Prisma
 * Handles database operations for cars
 */
export class CarRepository extends ICarRepository {
  /**
   * Get all active cars
   */
  async findAll() {
    const cars = await prisma.car.findMany({
      where: {
        status: true,
      },
      orderBy: { created_at: "desc" },
    });

    return cars.map((car) => Car.fromDatabase(car));
  }

  /**
   * Find cars by user ID
   */
  async findByUserId(userId) {
    const cars = await prisma.car.findMany({
      where: {
        user_id: BigInt(userId),
        status: true,
      },
      orderBy: { created_at: "desc" },
    });

    return cars.map((car) => Car.fromDatabase(car));
  }

  /**
   * Find car by ID
   */
  async findById(id) {
    const car = await prisma.car.findUnique({
      where: { id: BigInt(id) },
    });

    return car ? Car.fromDatabase(car) : null;
  }

  /**
   * Create new car
   */
  async create(carData) {
    const car = await prisma.car.create({
      data: {
        user_id: carData.user_id ? BigInt(carData.user_id) : null,
        car_number: carData.car_number || null,
        car_model: carData.car_model || null,
        car_brand: carData.car_brand || null,
        car_color: carData.car_color || null,
        info: carData.info || null,
        status: carData.status !== undefined ? carData.status : true,
        created_at: new Date(),
      },
    });

    return Car.fromDatabase(car);
  }

  /**
   * Update car by ID
   */
  async update(id, updateData) {
    const car = await prisma.car.update({
      where: { id: BigInt(id) },
      data: {
        ...(updateData.user_id !== undefined && {
          user_id: updateData.user_id ? BigInt(updateData.user_id) : null,
        }),
        ...(updateData.car_number !== undefined && {
          car_number: updateData.car_number,
        }),
        ...(updateData.car_model !== undefined && {
          car_model: updateData.car_model,
        }),
        ...(updateData.car_brand !== undefined && {
          car_brand: updateData.car_brand,
        }),
        ...(updateData.car_color !== undefined && {
          car_color: updateData.car_color,
        }),
        ...(updateData.info !== undefined && { info: updateData.info }),
        ...(updateData.status !== undefined && { status: updateData.status }),
      },
    });

    return Car.fromDatabase(car);
  }

  /**
   * Soft delete car (set status to false)
   */
  async softDelete(id) {
    const car = await prisma.car.update({
      where: { id: BigInt(id) },
      data: {
        status: false,
      },
    });

    return car !== null;
  }
}
