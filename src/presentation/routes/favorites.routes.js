import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { FavoritesController } from "../controllers/FavoritesController.js";

const router = express.Router();
const favoritesController = new FavoritesController();

/**
 * @route   GET /api/favorites
 * @desc    Список сохранённых объявлений текущего пользователя
 * @access  Private
 */
router.get("/", authenticateJWT, favoritesController.getFavorites);

/**
 * @route   POST /api/favorites/:adId
 * @desc    Сохранить объявление (повтор — не ошибка)
 * @access  Private
 */
router.post("/:adId", authenticateJWT, favoritesController.addFavorite);

/**
 * @route   DELETE /api/favorites/:adId
 * @desc    Убрать объявление из сохранённых
 * @access  Private
 */
router.delete("/:adId", authenticateJWT, favoritesController.removeFavorite);

export default router;
