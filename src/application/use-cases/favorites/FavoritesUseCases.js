import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Избранное жителя.
 *
 * Раньше «сердечко» было локальным `useState` в карточке: после перезагрузки
 * список пропадал, и на телефоне кнопка вообще была невидима. Храним на сервере,
 * чтобы подборка жила между устройствами.
 */

const toId = (value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new ValidationError("Некорректный идентификатор");
  }
  return BigInt(number);
};

/** Объявления должны существовать и быть активными — иначе в избранном будет мусор. */
const assertActiveAd = async (adId) => {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { id: true, status: true },
  });

  if (!ad || ad.status !== "active") {
    throw new NotFoundError("Объявление не найдено");
  }
};

export class ListFavoritesUseCase {
  async execute(userId) {
    const rows = await prisma.favoriteAd.findMany({
      where: { user_id: toId(userId) },
      orderBy: { created_at: "desc" },
      select: { ad_id: true, created_at: true },
    });

    return {
      adIds: rows.map((row) => Number(row.ad_id)),
      // created_at — Date; сериализуется глобальным BigInt.prototype.toJSON
      items: rows.map((row) => ({
        adId: Number(row.ad_id),
        addedAt: row.created_at,
      })),
    };
  }
}

export class AddFavoriteUseCase {
  async execute(userId, adId) {
    const user = toId(userId);
    const ad = toId(adId);

    await assertActiveAd(ad);

    // upsert: повторное нажатие не должно рождать дубль или падать на уникальном индексе
    const favorite = await prisma.favoriteAd.upsert({
      where: { user_id_ad_id: { user_id: user, ad_id: ad } },
      update: {},
      create: { user_id: user, ad_id: ad },
    });

    logger.info("Ad added to favorites", { userId: Number(user), adId: Number(ad) });

    return { adId: Number(favorite.ad_id), addedAt: favorite.created_at };
  }
}

export class RemoveFavoriteUseCase {
  async execute(userId, adId) {
    const user = toId(userId);
    const ad = toId(adId);

    const deleted = await prisma.favoriteAd.deleteMany({
      where: { user_id: user, ad_id: ad },
    });

    if (deleted.count === 0) {
      throw new NotFoundError("Это объявление не в избранном");
    }

    return { adId: Number(ad) };
  }
}
