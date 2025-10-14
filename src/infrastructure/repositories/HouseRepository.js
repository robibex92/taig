import { prisma } from "../database/prisma.js";
import { IHouseRepository } from "../../domain/repositories/IHouseRepository.js";
import { House } from "../../domain/entities/House.entity.js";

/**
 * House Repository Implementation with Prisma
 * Handles database operations for houses/apartments
 */
export class HouseRepository extends IHouseRepository {
  /**
   * Get all unique houses (distinct)
   */
  async findUniqueHouses() {
    const houses = await prisma.house.findMany({
      where: {
        status: true,
      },
      distinct: ["house"],
      orderBy: { house: "asc" },
      select: { house: true },
    });

    return houses.map((h) => h.house);
  }

  /**
   * Get all unique entrances for a house
   */
  async findEntrancesByHouse(house) {
    const entrances = await prisma.house.findMany({
      where: {
        house,
        status: true,
      },
      distinct: ["entrance"],
      orderBy: { entrance: "asc" },
      select: { entrance: true },
    });

    return entrances.map((e) => e.entrance);
  }

  /**
   * Find houses with filters
   */
  async findByFilters({ house, entrance, position }) {
    const where = {};

    if (house) {
      where.house = house;
    }

    if (entrance !== undefined) {
      where.entrance = entrance;
    }

    // If position not explicitly provided, default to position = 1
    if (position !== undefined && position !== null) {
      where.position = position;
    } else {
      where.position = 1;
    }

    const houses = await prisma.house.findMany({
      where,
      orderBy: { number: "asc" },
    });

    return houses.map((house) => House.fromDatabase(house));
  }

  /**
   * Find all houses by user telegram ID
   */
  async findByUserId(telegramId) {
    const houses = await prisma.house.findMany({
      where: {
        id_telegram: parseInt(telegramId),
      },
      orderBy: [
        { house: "asc" },
        { entrance: "asc" },
        { position: "asc" },
        { number: "asc" },
      ],
    });

    return houses.map((house) => House.fromDatabase(house));
  }

  /**
   * Find house by ID
   */
  async findById(id) {
    const house = await prisma.house.findUnique({
      where: { id: BigInt(id) },
    });

    return house ? House.fromDatabase(house) : null;
  }

  /**
   * Find base record (position=1) by house and number
   */
  async findBasePosition(house, number) {
    const houseRecord = await prisma.house.findFirst({
      where: {
        house,
        number,
        position: 1,
      },
    });

    return houseRecord ? House.fromDatabase(houseRecord) : null;
  }

  /**
   * Get max position for a specific apartment
   */
  async getMaxPosition(house, number) {
    const result = await prisma.house.aggregate({
      where: {
        house,
        number,
      },
      _max: {
        position: true,
      },
    });

    return result._max.position || 1;
  }

  /**
   * Count records with position=1 for apartment
   */
  async countPosition1Records(house, number) {
    const count = await prisma.house.count({
      where: {
        house,
        number,
        position: 1,
      },
    });

    return count;
  }

  /**
   * Find all records for a specific apartment ordered by position
   */
  async findAllByApartment(house, entrance, number) {
    const houses = await prisma.house.findMany({
      where: {
        house,
        entrance,
        number,
      },
      orderBy: { position: "asc" },
    });

    return houses.map((h) => House.fromDatabase(h));
  }

  /**
   * Update house telegram ID
   */
  async updateTelegramId(id, telegramId) {
    const house = await prisma.house.update({
      where: { id: BigInt(id) },
      data: {
        id_telegram: telegramId ? parseInt(telegramId) : null,
      },
    });

    return House.fromDatabase(house);
  }

  /**
   * Set telegram ID to null
   */
  async clearTelegramId(id) {
    await prisma.house.update({
      where: { id: BigInt(id) },
      data: {
        id_telegram: null,
      },
    });

    return true;
  }

  /**
   * Create new house record
   */
  async create(data) {
    const house = await prisma.house.create({
      data: {
        house: data.house,
        entrance: data.entrance,
        floor: data.floor,
        number: data.number,
        position: data.position,
        facade_color: data.facade_color || null,
        info: data.info || "",
        status: data.status !== undefined ? data.status : true,
        id_telegram: data.id_telegram ? parseInt(data.id_telegram) : null,
        created_at: new Date(),
      },
    });

    return House.fromDatabase(house);
  }

  /**
   * Delete house record
   */
  async deleteById(id) {
    await prisma.house.delete({
      where: { id: BigInt(id) },
    });

    return true;
  }

  /**
   * Update house info field
   */
  async updateInfo(id, info) {
    const house = await prisma.house.update({
      where: { id: BigInt(id) },
      data: {
        info: info || "",
      },
    });

    return House.fromDatabase(house);
  }
}
