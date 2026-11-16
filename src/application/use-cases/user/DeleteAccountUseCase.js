import { prisma } from "../../../infrastructure/database/prisma.js";
import { ValidationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Полное удаление собственного аккаунта (DELETE /api/users/me).
 *
 * Два режима, выбор за жителем:
 *  - `purge` — удаляется аккаунт и весь его контент (объявления, авто,
 *    комментарии, созданные события);
 *  - `anonymize` — аккаунт и личные данные удаляются, публичный контент
 *    (объявления, авто, комментарии, события) остаётся без автора.
 *
 * В обоих режимах: сессии, избранное, брони, участия в событиях, переписка
 * паркинга, привязка квартиры и владение местом — стираются; место на
 * парковке остаётся без владельца. Загруженные файлы переживают аккаунт
 * сознательно (см. модель UploadedFile) и убираются плановой уборкой.
 *
 * Всё в одной транзакции: сбой посередине не оставляет наполовину удалённый аккаунт.
 */
export class DeleteAccountUseCase {
  async execute(userId, mode) {
    if (mode !== "purge" && mode !== "anonymize") {
      throw new ValidationError("Режим удаления должен быть purge или anonymize");
    }

    const uid = BigInt(userId);

    const user = await prisma.user.findUnique({ where: { user_id: uid } });
    if (!user) {
      throw new ValidationError("Аккаунт не найден");
    }

    await prisma.$transaction(async (tx) => {
      // --- личные данные и активность (оба режима) ---
      await tx.refreshToken.deleteMany({ where: { user_id: uid } });
      await tx.authHandoff.deleteMany({ where: { user_id: uid } });
      await tx.favoriteAd.deleteMany({ where: { user_id: uid } });
      await tx.booking.deleteMany({ where: { user_id: uid } });
      await tx.eventRegistration.deleteMany({ where: { user_id: uid } });
      await tx.eventWaitlist.deleteMany({ where: { user_id: uid } });
      await tx.parkingMessage.deleteMany({
        where: { OR: [{ sender_id: uid }, { receiver_id: uid }] },
      });
      await tx.parkingSpot.updateMany({
        where: { owner_id: uid },
        data: { owner_id: null },
      });
      await tx.parkingSpotHistory.updateMany({
        where: { changed_by_id: uid },
        data: { changed_by_id: null },
      });
      await tx.carImage.updateMany({
        where: { added_by_user_id: uid },
        data: { added_by_user_id: null },
      });
      await tx.maxBotInboxMessage.updateMany({
        where: { user_id: uid },
        data: { user_id: null },
      });
      await tx.maxBotBroadcast.updateMany({
        where: { created_by: uid },
        data: { created_by: null },
      });
      await tx.maxBotBroadcastRecipient.updateMany({
        where: { user_id: uid },
        data: { user_id: null },
      });

      // Привязка квартиры: houses.id_telegram хранит telegram_id числом.
      const telegramIdNum = Number(user.telegram_id);
      if (user.telegram_id != null && Number.isSafeInteger(telegramIdNum)) {
        await tx.house.updateMany({
          where: { id_telegram: telegramIdNum },
          data: { id_telegram: null },
        });
      }

      if (mode === "purge") {
        await this._purgeContent(tx, uid);
      } else {
        await this._anonymizeContent(tx, uid);
      }

      await tx.user.delete({ where: { user_id: uid } });
    });

    logger.info("Account deleted", { user_id: String(uid), mode });

    return { success: true, mode };
  }

  /** Удаляет весь контент пользователя вместе с зависимыми записями. */
  async _purgeContent(tx, uid) {
    const [ads, cars, events] = await Promise.all([
      tx.ad.findMany({ where: { user_id: uid }, select: { id: true } }),
      tx.car.findMany({ where: { user_id: uid }, select: { id: true } }),
      tx.event.findMany({ where: { created_by: uid }, select: { id: true } }),
    ]);

    const adIds = ads.map((row) => row.id);
    const carIds = cars.map((row) => row.id);
    const eventIds = events.map((row) => row.id);

    // У ad_images/telegram_messages нет внешних ключей — чищаем явно.
    if (adIds.length) {
      await tx.telegramMessage.deleteMany({ where: { ad_id: { in: adIds } } });
      await tx.adImage.deleteMany({
        where: { ad_id: { in: adIds.map((id) => Number(id)) } },
      });
      await tx.booking.deleteMany({ where: { ad_id: { in: adIds } } });
      await tx.favoriteAd.deleteMany({ where: { ad_id: { in: adIds } } });
    }
    await tx.ad.deleteMany({ where: { user_id: uid } });

    if (carIds.length) {
      await tx.carImage.deleteMany({ where: { car_id: { in: carIds } } });
    }
    await tx.car.deleteMany({ where: { user_id: uid } });

    await tx.houseComment.deleteMany({ where: { author_id: uid } });
    await tx.entranceComment.deleteMany({ where: { author_id: uid } });

    if (eventIds.length) {
      await tx.eventRegistration.deleteMany({ where: { event_id: { in: eventIds } } });
      await tx.eventWaitlist.deleteMany({ where: { event_id: { in: eventIds } } });
      await tx.eventTelegramChat.deleteMany({ where: { event_id: { in: eventIds } } });
    }
    await tx.event.deleteMany({ where: { created_by: uid } });

    // Служебные заметки, написанные этим аккаунтом (если был админом).
    await tx.carAdminNote.deleteMany({ where: { created_by_admin_id: uid } });
    await tx.parkingSpotNote.deleteMany({ where: { created_by_admin_id: uid } });
  }

  /** Оставляет публичный контент, отвязывая его от автора. */
  async _anonymizeContent(tx, uid) {
    await tx.ad.updateMany({ where: { user_id: uid }, data: { user_id: null } });
    await tx.car.updateMany({ where: { user_id: uid }, data: { user_id: null } });
    await tx.houseComment.updateMany({
      where: { author_id: uid },
      data: { author_id: null },
    });
    await tx.entranceComment.updateMany({
      where: { author_id: uid },
      data: { author_id: null },
    });
    await tx.event.updateMany({
      where: { created_by: uid },
      data: { created_by: null },
    });
  }
}

export default DeleteAccountUseCase;