import { prisma } from "../database/prisma.js";
import { IFloorRuleRepository } from "../../domain/repositories/IFloorRuleRepository.js";
import { FloorRule } from "../../domain/entities/FloorRule.entity.js";

/**
 * FloorRule Repository Implementation with Prisma
 * Handles database operations for floor rules
 */
export class FloorRuleRepository extends IFloorRuleRepository {
  /**
   * Find floor rules by house and entrance
   */
  async findByHouseAndEntrance(house, entrance) {
    const rules = await prisma.floorRule.findMany({
      where: {
        house,
        entrance,
      },
      orderBy: { floor: "asc" },
    });

    return rules.map((rule) => FloorRule.fromDatabase(rule));
  }

  /**
   * Upsert floor rule (create or update)
   */
  async upsert(ruleData) {
    const rule = await prisma.floorRule.upsert({
      where: {
        unique_floor_rule: {
          house: ruleData.house,
          entrance: ruleData.entrance,
          floor: ruleData.floor,
        },
      },
      update: {
        position: ruleData.position,
      },
      create: {
        id: BigInt(Date.now()), // Generate unique ID
        house: ruleData.house,
        entrance: ruleData.entrance,
        floor: ruleData.floor,
        position: ruleData.position,
      },
    });

    return FloorRule.fromDatabase(rule);
  }
}
