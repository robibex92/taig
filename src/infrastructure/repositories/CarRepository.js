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
