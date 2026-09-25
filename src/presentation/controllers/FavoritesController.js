import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  AddFavoriteUseCase,
  ListFavoritesUseCase,
  RemoveFavoriteUseCase,
} from "../../application/use-cases/favorites/FavoritesUseCases.js";

/**
 * Избранное жителя: GET /api/favorites, POST|DELETE /api/favorites/:adId.
 * Всё под authenticateJWT — списки принадлежат конкретному человеку.
 */
export class FavoritesController {
  constructor() {
    this.list = new ListFavoritesUseCase();
    this.add = new AddFavoriteUseCase();
    this.remove = new RemoveFavoriteUseCase();
  }

  getFavorites = asyncHandler(async (req, res) => {
    const data = await this.list.execute(req.user.user_id);
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });

  addFavorite = asyncHandler(async (req, res) => {
    const { adId } = readParams(req);
    const data = await this.add.execute(req.user.user_id, adId);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data });
  });

  removeFavorite = asyncHandler(async (req, res) => {
    const { adId } = readParams(req);
    const data = await this.remove.execute(req.user.user_id, adId);
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });
}

const readParams = (req) => {
  const adId = Number.parseInt(req.params.adId, 10);

  if (!Number.isInteger(adId) || adId <= 0) {
    throw new ValidationError("Некорректный идентификатор объявления");
  }

  return { adId };
};
