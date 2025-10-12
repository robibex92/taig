const { logger } = require("../../core/utils/logger");

/**
 * Notification Service
 * Routes notifications to appropriate platform (Telegram or MAX)
 * Based on user preferences and platform availability
 */
class NotificationService {
  constructor({ userRepository, telegramService, maxService }) {
    this.userRepository = userRepository;
    this.telegramService = telegramService;
    this.maxService = maxService;
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

      if (platforms.includes("max") && user.max_id) {
        promises.push(
          this.maxService
            .sendNotification(user.max_id, notification)
            .catch((error) => {
              logger.error("Failed to send MAX notification", {
                userId,
                max_id: user.max_id,
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
    // If only one platform is linked, use it
    if (!user.platforms_linked) {
      if (user.id_telegram) return ["telegram"];
      if (user.max_id) return ["max"];
      return [];
    }

    // Both platforms are linked - check user preference
    // TODO: Add user setting for "notify_both_platforms"
    // For now, use primary_platform only
    return [user.primary_platform];
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

module.exports = NotificationService;
