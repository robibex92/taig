import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT, authenticateOptional } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import { updateUserSchema } from "../../core/validation/schemas/user.schema.js";
import {
  userAdsParamsSchema,
  userAdsQuerySchema,
} from "../../core/validation/schemas/ad.schema.js";
import { upload } from "../../core/middlewares/uploadMiddleware.js";

const router = express.Router();
const publicRouter = express.Router();
const userController = container.resolve("userController");

// Public routes
publicRouter.get("/users/:id", userController.getUserById);
publicRouter.get("/users/:id/avatar", userController.getUserAvatar);
// Публичный список объявлений пользователя: `/api/ads/user/:user_id`.
// `authenticateOptional` здесь нужен не для доступа, а для того, чтобы
// сервер понял, что спрашивает владелец, и вернул архив/удалённые + `counts`.
publicRouter.get(
  "/ads/user/:user_id",
  authenticateOptional,
  validateRequest(userAdsParamsSchema, "params"),
  validateRequest(userAdsQuerySchema, "query"),
  userController.getUserAds
);

// Protected routes
router.get("/users/me", authenticateJWT, userController.getCurrentUser);

router.get("/users/me/roles", authenticateJWT, userController.getUserRoles);

router.patch(
  "/users/me",
  authenticateJWT,
  validateRequest(updateUserSchema, "body"),
  userController.updateProfile
);

router.post(
  "/users/avatar",
  authenticateJWT,
  upload.single("avatar"),
  userController.uploadAvatar
);

export { router as userRoutes, publicRouter as publicUserRoutes };
