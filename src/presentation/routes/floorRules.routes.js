import express from "express";
import { container } from "../../infrastructure/container/Container.js";

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
 * @desc    Create or update floor rule (upsert)
 * @access  Private (add auth middleware if needed)
 */
router.post("/floor-rules", floorRuleController.upsert);

export default router;
