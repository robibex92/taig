import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ForbiddenError } from "../../core/errors/AppError.js";
import { canManageHouse } from "../../core/utils/roles.js";
import { validate } from "../../core/validation/validator.js";
import {
  getFloorRulesSchema,
  upsertFloorRuleSchema,
  floorOffsetsSchema,
} from "../../core/validation/schemas/floorRule.schema.js";

/**
 * FloorRule Controller
 * Handles HTTP requests for floor rule operations
 */
export class FloorRuleController {
  constructor({ getFloorRulesUseCase, upsertFloorRuleUseCase, setFloorOffsetsUseCase }) {
    this.getFloorRulesUseCase = getFloorRulesUseCase;
    this.upsertFloorRuleUseCase = upsertFloorRuleUseCase;
    this.setFloorOffsetsUseCase = setFloorOffsetsUseCase;
  }

  /**
   * GET /api-v1/floor-rules
   * Get floor rules by house and entrance
   */
  getAll = asyncHandler(async (req, res) => {
    const { house, entrance } = validate(getFloorRulesSchema, req.query);

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
   * Создать или обновить отступ одного этажа. Право — роль управляющего домом.
   */
  upsert = asyncHandler(async (req, res) => {
    const rule = validate(upsertFloorRuleSchema, req.body);

    if (!canManageHouse(req.user, rule.house)) {
      throw new ForbiddenError("Только управляющие домом могут менять отступ ряда");
    }

    const floorRule = await this.upsertFloorRuleUseCase.execute(rule);

    res.status(200).json({
      success: true,
      data: floorRule,
    });
  });

  /**
   * PATCH /api-v1/floor-rules/offsets
   * Отступ ряда сразу для списка этажей подъезда — одним запросом.
   */
  setOffsets = asyncHandler(async (req, res) => {
    const { house, entrance, floors, position } = validate(floorOffsetsSchema, req.body);

    const updated = await this.setFloorOffsetsUseCase.execute(
      { house, entrance, floors, position },
      req.user
    );

    res.status(200).json({
      success: true,
      data: updated,
    });
  });
}

export default FloorRuleController;
