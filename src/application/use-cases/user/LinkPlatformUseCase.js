import { AuthenticationError, ValidationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { prisma } from "../../../infrastructure/database/prisma.js";

const STATUS_RANK = {
  admin: 3,
  moderator: 2,
  active: 1,
  blocking: 0,
  blocked: 0,
  banned: 0,
};

/**
 * Link Telegram or MAX identity to the currently logged-in user.
 * If the other identity already has a row, merge it into the current user
 * so status/rights stay on one shared account.
 */
export class LinkPlatformUseCase {
  constructor(userRepository, authenticateUserUseCase, authenticateMaxUserUseCase) {
    this.userRepository = userRepository;
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.authenticateMaxUserUseCase = authenticateMaxUserUseCase;
  }

  pickStatus(a, b) {
    const ra = STATUS_RANK[a] ?? 1;
    const rb = STATUS_RANK[b] ?? 1;
    return ra >= rb ? a || "active" : b || "active";
  }

  async reassignUserId(fromId, toId) {
    const from = BigInt(fromId);
    const to = BigInt(toId);

    const reassign = async (model, field) => {
      try {
        await prisma[model].updateMany({
          where: { [field]: from },
          data: { [field]: to },
        });
      } catch (error) {
        if (error.code === "P2002") {
          await prisma[model].deleteMany({ where: { [field]: from } });
          return;
        }
        throw error;
      }
    };

    await reassign("ad", "user_id");
    await reassign("booking", "user_id");
    await reassign("event", "created_by");
    await reassign("eventRegistration", "user_id");
    await reassign("eventWaitlist", "user_id");
    await reassign("parkingSpot", "owner_id");
    await reassign("parkingMessage", "sender_id");
    await reassign("parkingMessage", "receiver_id");
    await reassign("car", "user_id");
    await reassign("carImage", "added_by_user_id");
    await reassign("houseComment", "author_id");
    await reassign("entranceComment", "author_id");
    await reassign("refreshToken", "user_id");

    const fromNum = Number(fromId);
    const toNum = Number(toId);
    if (Number.isSafeInteger(fromNum) && Number.isSafeInteger(toNum)) {
      await prisma.house.updateMany({
        where: { id_telegram: fromNum },
        data: { id_telegram: toNum },
      });
    }
  }

  async mergeInto(currentUser, otherUser) {
    if (String(currentUser.user_id) === String(otherUser.user_id)) {
      return currentUser;
    }

    const mergedStatus = this.pickStatus(currentUser.status, otherUser.status);

    await prisma.$transaction(async () => {
      await this.reassignUserId(otherUser.user_id, currentUser.user_id);
      await prisma.user.delete({
        where: { user_id: BigInt(otherUser.user_id) },
      });
    });

    await this.userRepository.update(currentUser.user_id, {
      status: mergedStatus,
      telegram_id: otherUser.telegram_id ?? currentUser.telegram_id,
      max_id: otherUser.max_id ?? currentUser.max_id,
      max_username: otherUser.max_username ?? currentUser.max_username,
      max_first_name: otherUser.max_first_name ?? currentUser.max_first_name,
      max_last_name: otherUser.max_last_name ?? currentUser.max_last_name,
      max_avatar: otherUser.max_avatar ?? currentUser.max_avatar,
    });

    logger.info("Merged user accounts", {
      kept_user_id: currentUser.user_id,
      removed_user_id: otherUser.user_id,
      status: mergedStatus,
    });

    return this.userRepository.findById(currentUser.user_id);
  }

  async linkMax(currentUserId, initData) {
    const { valid, user: maxUser, authDate } =
      this.authenticateMaxUserUseCase.verifyInitData(initData);

    if (!valid || !maxUser?.id) {
      throw new AuthenticationError("Invalid MAX authentication");
    }
    if (!this.authenticateMaxUserUseCase.isAuthDateValid(authDate)) {
      throw new AuthenticationError("Authentication data expired");
    }

    const current = await this.userRepository.findById(currentUserId);
    if (!current) {
      throw new AuthenticationError("User not found");
    }

    const existing = await this.userRepository.findByMaxId(maxUser.id);
    if (existing && String(existing.user_id) !== String(current.user_id)) {
      if (existing.hasTelegram() && current.hasTelegram()) {
        throw new ValidationError(
          "Этот MAX уже привязан к другому аккаунту Telegram"
        );
      }
      return this.mergeInto(current, existing);
    }

    return this.userRepository.update(current.user_id, {
      max_id: maxUser.id,
      max_username: maxUser.username || null,
      max_first_name: maxUser.first_name || null,
      max_last_name: maxUser.last_name || null,
      max_avatar: maxUser.photo_url || null,
    });
  }

  async linkTelegram(currentUserId, telegramAuthData, deviceInfo = {}, rememberMe = false) {
    const isValid = this.authenticateUserUseCase.verifyTelegramAuth(telegramAuthData);
    if (!isValid) {
      throw new AuthenticationError("Invalid Telegram authentication");
    }
    if (!this.authenticateUserUseCase.isAuthDateValid(telegramAuthData.auth_date)) {
      throw new AuthenticationError("Authentication data expired");
    }

    const current = await this.userRepository.findById(currentUserId);
    if (!current) {
      throw new AuthenticationError("User not found");
    }

    const telegramId = telegramAuthData.id;
    const existing = await this.userRepository.findByTelegramId(telegramId);

    if (existing && String(existing.user_id) !== String(current.user_id)) {
      if (existing.max_id && current.max_id && String(existing.max_id) !== String(current.max_id)) {
        throw new ValidationError(
          "Этот Telegram уже привязан к другому аккаунту MAX"
        );
      }
      // Keep Telegram user_id as canonical (used across ads, houses, etc.)
      const merged = await this.mergeInto(existing, current);
      await this.userRepository.update(merged.user_id, {
        username: telegramAuthData.username || merged.username,
        telegram_first_name: telegramAuthData.first_name,
        telegram_last_name: telegramAuthData.last_name || null,
        avatar: telegramAuthData.photo_url || merged.avatar,
      });

      const user = await this.userRepository.findById(merged.user_id);

      /**
       * MAX-аккаунт (current) удалён при слиянии,
       * поэтому старый access token больше не валиден.
       * Выдаём свежую сессию для объединённого аккаунта.
       */
      const session = await this.authenticateMaxUserUseCase.issueSession(
        user,
        deviceInfo,
        rememberMe
      );

      return {
        user: session.user,
        switchedToUserId: merged.user_id,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    }

    if (String(current.user_id) !== String(telegramId) && !existing) {
      throw new ValidationError(
        "Нельзя сменить Telegram ID текущего аккаунта. Войдите через Telegram и привяжите MAX."
      );
    }

    const user = await this.userRepository.update(current.user_id, {
      username: telegramAuthData.username || current.username,
      telegram_first_name: telegramAuthData.first_name,
      telegram_last_name: telegramAuthData.last_name || null,
      avatar: telegramAuthData.photo_url || current.avatar,
    });

    return {
      user,
      switchedToUserId: null,
      accessToken: null,
      refreshToken: null,
    };
  }
}
