import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { HTTP_STATUS } from "../../core/constants/index.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Личные сообщения жителям: «написать владельцу места / объявления / авто /
 * соседу». Получатель задаётся человеком (`user_id` или `id_telegram`), а не
 * чатом — какой мессенджер и какой id подставить, решает MessageDeliveryService.
 *
 * Обратная связь с сайта (`contextType: 'feedback'`) идёт своим путём: там
 * адресат — фиксированный чат администрации, а не житель.
 */

const CHANNELS = new Set(["telegram", "max", "auto"]);

/** Коды доставки → HTTP: клиент по ним решает, что показать (выбор канала, «нет диалога»). */
const STATUS_BY_CODE = {
  "empty.text": HTTP_STATUS.BAD_REQUEST,
  no_recipient: HTTP_STATUS.NOT_FOUND,
  no_channel: HTTP_STATUS.CONFLICT,
  channel_unavailable: HTTP_STATUS.CONFLICT,
  "dialog.not.found": HTTP_STATUS.CONFLICT,
};

export class ContactController {
  constructor({ delivery, telegramService, db }) {
    this.delivery = delivery;
    this.telegramService = telegramService;
    this.db = db;
  }

  /**
   * GET /api/contacts/availability?user_id=123 | ?id_telegram=777
   * { found, telegram, max } — только флаги, без самих id.
   */
  availability = asyncHandler(async (req, res) => {
    const { user_id: userId, id_telegram: idTelegram } = req.query;

    const result = await this.delivery.availability({ userId, idTelegram });

    res.status(HTTP_STATUS.OK).json({ success: true, data: result });
  });

  /**
   * POST /api/contacts/send
   * { user_id | id_telegram, message, contextType, contextData, channel }
   */
  send = asyncHandler(async (req, res) => {
    const { user_id: userId, id_telegram: idTelegram, message, contextType, contextData } =
      req.body;
    const requestedChannel = req.body.channel || "auto";

    if (!CHANNELS.has(requestedChannel)) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, error: "Неизвестный канал доставки" });
    }

    const senderId = req.user?.user_id ?? null;
    const availability = await this.delivery.availability({ userId, idTelegram });

    if (!availability.found) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, error: "Получатель не найден", code: "no_recipient" });
    }

    if (!availability.telegram && !availability.max) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: "У получателя не привязан ни один мессенджер",
        code: "no_channel",
        channels: availability,
      });
    }

    const channel =
      requestedChannel === "auto"
        ? availability.telegram
          ? "telegram"
          : "max"
        : requestedChannel;

    if (!availability[channel]) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: channel === "telegram" ? "У получателя нет Telegram" : "У получателя нет MAX",
        code: "channel_unavailable",
        channels: availability,
      });
    }

    const author = await this.authorInfo(senderId);

    const finalMessage = this.telegramService.buildContextMessage({
      message,
      contextType,
      contextData,
      user_id: senderId,
      telegram_id: author.telegramId,
      dbUsername: author.username,
      format: channel === "telegram" ? "HTML" : "plain",
    });

    const result = await this.delivery.deliver({
      userId,
      idTelegram,
      text: finalMessage,
      channel,
    });

    if (result.ok) {
      logger.info("Contact message delivered", { channel, contextType, senderId });
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { channel: result.channel, channels: result.channels },
      });
    }

    logger.warn("Contact message not delivered", { channel, code: result.code });
    return res
      .status(STATUS_BY_CODE[result.code] || HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({
        success: false,
        error: result.error,
        code: result.code,
        skipped: result.skipped ?? false,
        channels: result.channels,
      });
  });

  async authorInfo(userId) {
    if (!userId) return { username: null, telegramId: null };

    const author = await this.db.user.findUnique({
      where: { user_id: BigInt(userId) },
      select: { username: true, telegram_id: true },
    });

    return {
      username: author?.username || null,
      telegramId: author?.telegram_id ? String(author.telegram_id) : null,
    };
  }
}

export default ContactController;
