const cron = require("node-cron");
const { prisma } = require("../infrastructure/database/prisma");
const { logger } = require("../core/utils/logger");

/**
 * Cron Job: Archive Expired Ads
 * Runs every day at 00:00 (midnight)
 * Checks for expired ads and archives them
 */
class ArchiveExpiredAdsJob {
  constructor({ telegramService }) {
    this.telegramService = telegramService;
  }

  /**
   * Start the cron job
   */
  start() {
    // Run every day at 00:00
    cron.schedule("0 0 * * *", async () => {
      logger.info("Running archiveExpiredAds cron job");
      await this.execute();
    });

    logger.info("ArchiveExpiredAds cron job scheduled (daily at 00:00)");
  }

  /**
   * Execute the archival process
   */
  async execute() {
    try {
      // Find all expired ads
      const expiredAds = await prisma.ad.findMany({
        where: {
          expires_at: {
            lte: new Date(),
          },
          status: "active",
        },
        include: {
          telegram_messages: true,
          user: true,
        },
      });

      logger.info(`Found ${expiredAds.length} expired ads to archive`);

      for (const ad of expiredAds) {
        try {
          // Get ad statistics
          const stats = await this._getAdStats(ad.id);

          // Archive the ad
          await prisma.ad.update({
            where: { id: ad.id },
            data: {
              status: "archived",
              updated_at: new Date(),
            },
          });

          // Update Telegram messages
          if (ad.telegram_messages && ad.telegram_messages.length > 0) {
            const messageIds = ad.telegram_messages.map((tm) => ({
              chatId: tm.chat_id,
              messageId: tm.message_id,
            }));

            await this.telegramService.updateAdInTelegram(
              ad.id,
              messageIds,
              "archived"
            );
          }

          // Notify owner
          if (ad.user && ad.user.id_telegram) {
            await this.telegramService.notifyOwnerAboutArchival(
              ad.user.id,
              ad,
              stats
            );
          }

          logger.info(`Ad archived successfully`, { adId: ad.id });
        } catch (error) {
          logger.error(`Failed to archive ad`, {
            adId: ad.id,
            error: error.message,
          });
        }
      }

      logger.info("ArchiveExpiredAds cron job completed");
    } catch (error) {
      logger.error("Error in archiveExpiredAds cron job", {
        error: error.message,
      });
    }
  }

  /**
   * Get ad statistics
   * @private
   */
  async _getAdStats(adId) {
    const [commentsCount, bookingsCount] = await Promise.all([
      prisma.comment.count({
        where: { ad_id: adId, is_deleted: false },
      }),
      prisma.booking.count({
        where: { ad_id: adId },
      }),
    ]);

    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      select: { view_count: true },
    });

    return {
      view_count: ad?.view_count || 0,
      comments_count: commentsCount,
      bookings_count: bookingsCount,
    };
  }
}

module.exports = ArchiveExpiredAdsJob;
