import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  getFloorRulesSchema,
  upsertFloorRuleSchema,
} from "../../core/validation/schemas/floorRule.schema.js";

/**
 * FloorRule Controller
 * Handles HTTP requests for floor rule operations
 */
export class FloorRuleController {
  constructor(getFloorRulesUseCase, upsertFloorRuleUseCase) {
    this.getFloorRulesUseCase = getFloorRulesUseCase;
    this.upsertFloorRuleUseCase = upsertFloorRuleUseCase;
  }

  /**
   * GET /api-v1/floor-rules
   * Get floor rules by house and entrance
   */
  getAll = asyncHandler(async (req, res) => {
    const { error } = getFloorRulesSchema.validate(req.query);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { house, entrance } = req.query;
    const floorRules = await this.getFloorRulesUseCase.execute(
      house,
      parseInt(entrance)
    );

    res.json({
      success: true,
      data: floorRules,
    });
  });

  /**
   * POST /api-v1/floor-rules
   * Create or update floor rule (upsert)
   */
  upsert = asyncHandler(async (req, res) => {
    const { error } = upsertFloorRuleSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const floorRule = await this.upsertFloorRuleUseCase.execute(req.body);

    res.status(200).json({
      success: true,
      data: floorRule,
    });
  });
}
