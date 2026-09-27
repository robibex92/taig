import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();
const floorRuleController = container.resolve("floorRuleController");

/**
 * @route   GET /floor-rules
 * @desc    Get floor rules by house and entrance
 * @access  Public
 */
router.get("/floor-rules", floorRuleController.getAll);

/**
 * @route   POST /floor-rules
 * @desc    Создать или обновить отступ одного этажа
 * @access  Private (управляющий домом)
 */
router.post("/floor-rules", authenticateJWT, floorRuleController.upsert);

/**
 * @route   PATCH /floor-rules/offsets
 * @desc    Отступ ряда сразу для списка этажей подъезда
 * @access  Private (управляющий домом)
 */
router.patch("/floor-rules/offsets", authenticateJWT, floorRuleController.setOffsets);

export default router;
