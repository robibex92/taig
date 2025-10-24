import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { logger } from "../../core/utils/logger.js";
import adRepository from "../../infrastructure/repositories/AdRepository.js";
import userRepository from "../../infrastructure/repositories/UserRepository.js";
import messageRepository from "../../infrastructure/repositories/MessageRepository.js";

// Утилита для форматирования имени отправителя
function formatSenderName(sender) {
  if (!sender) return "Пользователь";

  // Приоритет: username (с @), затем telegram_first_name, затем first_name
  if (sender.username) {
    return `@${sender.username}`;
  }

  if (sender.telegram_first_name) {
    return sender.telegram_first_name;
  }

  if (sender.first_name) {
    return sender.first_name;
  }

  return "Пользователь";
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Telegram Bot Handler
 * Handles incoming messages and replies from Telegram users
 */
export class TelegramBot {
  constructor() {
    this.bot = bot;
    this.adRepository = adRepository;
    this.userRepository = userRepository;
    this.messageRepository = messageRepository;
    this.setupHandlers();
  }

  /**
   * Setup bot message handlers
   */
  setupHandlers() {
    // Handle replies to bot messages
    this.bot.on(message("text"), async (ctx) => {
      try {
        // Check if message is a reply
        if (!ctx.message.reply_to_message) {
          return; // Ignore non-reply messages
        }

        const replyToMessage = ctx.message.reply_to_message;

        // Check if reply is to bot's message
        if (
          !replyToMessage.from.is_bot ||
          replyToMessage.from.id !== ctx.botInfo.id
        ) {
          return; // Not a reply to bot
        }

        logger.info("Received reply to bot message", {
          chat_id: ctx.chat.id,
          reply_to_message_id: replyToMessage.message_id,
          from_user: ctx.from.id,
          text: ctx.message.text,
        });

        // Find the ad by message_id
        const telegramMessage =
          await this.adRepository.getTelegramMessageByMessageId(
            replyToMessage.message_id.toString(),
            ctx.chat.id.toString()
          );

        if (!telegramMessage || !telegramMessage.ad_id) {
          logger.warn("Ad not found for replied message", {
            message_id: replyToMessage.message_id,
            chat_id: ctx.chat.id,
          });
          return;
        }

        const adId = telegramMessage.ad_id;

        // Get ad details
        const ad = await this.adRepository.findById(adId);
        if (!ad) {
          logger.error("Ad not found", { ad_id: adId });
          return;
        }

        // Get ad owner
        const adOwner = await this.userRepository.findById(ad.user_id);
        if (!adOwner) {
          logger.error("Ad owner not found", { user_id: ad.user_id });
          return;
        }

        // Get replier info
        const replierName =
          ctx.from.first_name || ctx.from.username || "Пользователь";
        const replierUsername = ctx.from.username || null;
        const replyText = ctx.message.text;

        // Send notification to ad owner via Telegram
        try {
          let notificationText = `📩 <b>Новый вопрос по вашему объявлению</b>\n\n`;
          notificationText += `📢 Объявление: <b>${ad.title}</b>\n\n`;
          notificationText += `👤 От: ${formatSenderName({
            username: ctx.from.username,
            first_name: ctx.from.first_name,
            telegram_first_name: ctx.from.first_name,
          })}\n`;
          notificationText += `💬 Сообщение:\n<i>"${replyText}"</i>\n\n`;
          notificationText += `🔗 Просмотреть объявление: https://taiginsky.md/ads/${adId}`;

          await ctx.telegram.sendMessage(
            adOwner.user_id.toString(),
            notificationText,
            {
              parse_mode: "HTML",
            }
          );

          logger.info("Reply forwarded to ad owner", {
            ad_id: adId,
            owner_id: adOwner.user_id,
            replier_id: ctx.from.id,
          });

          // Optionally: Save to internal messages system
          try {
            await this.messageRepository.create({
              sender_id: BigInt(ctx.from.id),
              receiver_id: BigInt(adOwner.user_id),
              ad_id: BigInt(adId),
              content: `Вопрос из Telegram: "${replyText}"`,
              is_read: false,
            });
          } catch (msgErr) {
            logger.error("Failed to save message to database", {
              error: msgErr.message,
            });
          }

          // Confirm to replier
          await ctx.reply("✅ Ваше сообщение отправлено автору объявления!", {
            reply_to_message_id: ctx.message.message_id,
          });
        } catch (sendErr) {
          logger.error("Failed to forward reply to ad owner", {
            error: sendErr.message,
            ad_id: adId,
            owner_id: adOwner.user_id,
          });

          // Inform replier that message couldn't be delivered
          await ctx.reply(
            "❌ К сожалению, не удалось доставить ваше сообщение автору. Попробуйте связаться напрямую.",
            { reply_to_message_id: ctx.message.message_id }
          );
        }
      } catch (error) {
        logger.error("Error handling Telegram reply", {
          error: error.message,
          stack: error.stack,
        });
      }
    });

    logger.info("Telegram bot handlers initialized");
  }

  /**
   * Start bot (webhook or polling)
   */
  async launch() {
    try {
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

      if (webhookUrl) {
        // Use webhook (production)
        await this.bot.telegram.setWebhook(webhookUrl);
        logger.info("Telegram bot webhook set", { url: webhookUrl });
      } else {
        // Use polling (development)
        await this.bot.launch();
        logger.info("Telegram bot started with polling");
      }
    } catch (error) {
      logger.error("Failed to launch Telegram bot", {
        error: error.message,
      });
    }
  }

  /**
   * Stop bot
   */
  async stop() {
    await this.bot.stop();
    logger.info("Telegram bot stopped");
  }

  /**
   * Get bot middleware for Express (webhook mode)
   */
  getWebhookMiddleware() {
    return this.bot.webhookCallback("/telegram-webhook");
  }
}

export default new TelegramBot();
