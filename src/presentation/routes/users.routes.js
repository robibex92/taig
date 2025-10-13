import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import { updateUserSchema } from "../../core/validation/schemas/user.schema.js";

const router = express.Router();
const publicRouter = express.Router();
const userController = container.resolve("userController");

// Public routes
publicRouter.get("/users/:id", userController.getUserById);
publicRouter.get("/users/:id/avatar", userController.getUserAvatar);
publicRouter.get("/ads/user/:user_id", userController.getUserAds);

// Protected routes
router.get("/users/me", authenticateJWT, userController.getCurrentUser);

router.get("/users/me/status", authenticateJWT, userController.getUserStatus);

router.patch(
  "/users/me",
  authenticateJWT,
  validateRequest(updateUserSchema, "body"),
  userController.updateProfile
);

export { router as userRoutes, publicRouter as publicUserRoutes };
