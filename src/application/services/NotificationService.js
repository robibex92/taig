import { logger } from "../../core/utils/logger.js";

/**
 * Notification Service
 * Routes notifications to Telegram
 */
class NotificationService {
  constructor({ userRepository, telegramService }) {
    this.userRepository = userRepository;
    this.telegramService = telegramService;
  }

  /**
   * Send notification to user via their preferred platform(s)
   */
  async notifyUser(userId, notification) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        logger.warn("Cannot send notification - user not found", { userId });
        return;
      }

      const platforms = this._getNotificationPlatforms(user);

      const promises = [];

      if (platforms.includes("telegram") && user.id_telegram) {
        promises.push(
          this.telegramService
            .sendNotification(user.id_telegram, notification)
            .catch((error) => {
              logger.error("Failed to send Telegram notification", {
                userId,
                id_telegram: user.id_telegram,
                error: error.message,
              });
            })
        );
      }

      await Promise.all(promises);

      logger.info("Notification sent", {
        userId,
        platforms,
        type: notification.type,
      });
    } catch (error) {
      logger.error("Failed to send notification", {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Determine which platform(s) to use for notifications
   */
  _getNotificationPlatforms(user) {
    // Use Telegram only
    if (user.id_telegram) return ["telegram"];
    return [];
  }

  /**
   * Notify multiple users (bulk operation)
   */
  async notifyUsers(userIds, notification) {
    const promises = userIds.map((userId) =>
      this.notifyUser(userId, notification).catch((error) => {
        logger.error("Failed to notify user in bulk operation", {
          userId,
          error: error.message,
        });
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Notify about new booking
   */
  async notifyNewBooking(sellerId, booking, queuePosition) {
    await this.notifyUser(sellerId, {
      type: "new_booking",
      data: { booking, queuePosition },
    });
  }

  /**
   * Notify about booking status change
   */
  async notifyBookingStatus(buyerId, booking, status) {
    await this.notifyUser(buyerId, {
      type: "booking_status",
      data: { booking, status },
    });
  }

  /**
   * Notify about ad archival
   */
  async notifyAdArchived(ownerId, ad, stats) {
    await this.notifyUser(ownerId, {
      type: "ad_archived",
      data: { ad, stats },
    });
  }

  /**
   * Notify about new comment
   */
  async notifyNewComment(recipientId, comment, ad) {
    await this.notifyUser(recipientId, {
      type: "new_comment",
      data: { comment, ad },
      message: `💬 Новый комментарий к объявлению "${ad.title}"`,
    });
  }
}

export default NotificationService;
