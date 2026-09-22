import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../core/utils/logger.js";
import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import { maxBotService as defaultService } from "../../../infrastructure/services/MaxBotService.js";
import {
  MAX_BOT_BROADCAST_ACTIVE_STATUSES,
  MAX_BOT_INBOX_DIRECTION,
  MAX_BOT_STATE_KEYS,
  validateMaxBotText,
} from "../../../core/constants/maxBot.js";
import {
  countMaxBotAudience,
  describeMaxBotAudience,
  parseMaxBotAudience,
  resolveMaxBotAudience,
} from "./MaxBotAudience.js";
import { indexUsersById, mapInboxRow } from "./maxBotMapper.js";

const AUDIENCE_PREVIEW_SAMPLE = 8;

/**
 * Экран «MAX-бот»: статус интеграции, журнал входящих, ответы, предпросмотр аудитории,
 * регистрация webhook. Рассылки — в MaxBotBroadcastUseCases.
 */
export class MaxBotAdminUseCases {
  constructor({ db = prisma, service = defaultService, poller = null, loggerImpl } = {}) {
    this.db = db;
    this.service = service;
    this.poller = poller;
    this.log = loggerImpl ?? logger;
  }

  /** Курсор long polling из таблицы состояния. */
  async getCursor() {
    try {
      const state = await this.db.maxBotState.findUnique({
        where: { key: MAX_BOT_STATE_KEYS.UPDATES_MARKER },
      });
      return state?.value ?? null;
    } catch (error) {
      this.log.warn("MAX-бот: не удалось прочитать курсор", { error: error.message });
      return null;
    }
  }

  /**
   * GET /api/admin/max-bot/status
   * `bot` — ответ GET /me (или null, если бот недоступен/не настроен).
   */
  async getStatus() {
    const configured = this.service.isConfigured();

    const [me, inboxTotal, inboxUnhandled, broadcastsActive, cursor] = await Promise.all([
      configured
        ? this.service
            .getMe()
            .then((payload) => payload?.payload ?? payload ?? null)
            .catch((error) => {
              this.log.warn("MAX-бот: GET /me не удался", { error: error.message });
              return new Error(error.message);
            })
        : Promise.resolve(null),
      this.db.maxBotInboxMessage.count({
        where: { direction: MAX_BOT_INBOX_DIRECTION.IN },
      }),
      this.db.maxBotInboxMessage.count({
        where: {
          direction: MAX_BOT_INBOX_DIRECTION.IN,
          is_handled: false,
        },
      }),
      this.db.maxBotBroadcast.count({
        where: { status: { in: MAX_BOT_BROADCAST_ACTIVE_STATUSES } },
      }),
      this.getCursor(),
    ]);

    const botError = me instanceof Error ? me.message : null;

    return {
      configured,
      polling: Boolean(this.poller?.isRunning?.()),
      bot: botError ? null : me,
      bot_error: botError,
      api_base_url: this.service.baseUrl,
      inbox_total: inboxTotal,
      inbox_unhandled: inboxUnhandled,
      broadcasts_active: broadcastsActive,
      cursor,
    };
  }

  /**
   * GET /api/admin/max-bot/inbox
   * Лента в обе стороны: входящие жители + исходящие ответы администратора,
   * новые сверху.
   */
  async listInbox({ limit = 50, offset = 0, onlyUnhandled = false, search = null } = {}) {
    const where = {
      ...(onlyUnhandled
        ? { direction: MAX_BOT_INBOX_DIRECTION.IN, is_handled: false }
        : {}),
      ...(search
        ? {
            OR: [
              { text: { contains: search, mode: "insensitive" } },
              { display_name: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.maxBotInboxMessage.findMany({
        where,
        orderBy: [{ received_at: "desc" }, { id: "desc" }],
        take: Math.min(Math.max(Number(limit) || 50, 1), 200),
        skip: Math.max(Number(offset) || 0, 0),
      }),
      this.db.maxBotInboxMessage.count({ where }),
    ]);

    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean).map(String))];
    const users = userIds.length
      ? await this.db.user.findMany({
          where: { user_id: { in: userIds.map((id) => BigInt(id)) } },
          select: { user_id: true, username: true, first_name: true, last_name: true, avatar: true },
        })
      : [];
    const index = indexUsersById(users);

    return {
      items: rows.map((row) => mapInboxRow(row, index)),
      total,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    };
  }

  /** POST /api/admin/max-bot/inbox/:id/handle */
  async setMessageHandled({ id, handled, note, actorUserId }) {
    const original = await this._requireInboxRow(id);

    const row = await this.db.maxBotInboxMessage.update({
      where: { id: original.id },
      data: {
        is_handled: Boolean(handled),
        note: typeof note === "string" ? note.trim() || null : original.note,
        handled_by: handled ? (actorUserId ? BigInt(actorUserId) : null) : original.handled_by,
        handled_at: handled ? new Date() : null,
      },
    });

    return mapInboxRow(row);
  }

  /**
   * POST /api/admin/max-bot/inbox/:id/reply
   * Отправка прямого ответа через бота + запись исходящего сообщения в ленту.
   */
  async replyToMessage({ id, text, actorUserId }) {
    const original = await this._requireInboxRow(id);
    const message = validateMaxBotText(text);

    if (!this.service.isConfigured()) {
      throw new ValidationError("MAX_BOT_TOKEN не задан — отправка невозможна");
    }

    const result = await this.service.sendMessage(String(original.max_user_id), message);

    if (!result.ok) {
      // 404 dialog.not.found для жителя, не открывавшего чат, — ожидаемый случай
      throw new ValidationError(
        result.skipped
          ? "У этого жителя нет диалога с ботом: он должен сам написать боту, чтобы получить ответ"
          : `MAX API не принял ответ: ${result.error}`
      );
    }

    const created = await this.db.maxBotInboxMessage.create({
      data: {
        direction: MAX_BOT_INBOX_DIRECTION.OUT,
        max_user_id: original.max_user_id,
        user_id: original.user_id,
        display_name: original.display_name,
        username: original.username,
        text: message,
        // Исходящие не требуют обработки и не должны попадать в «необработанные»
        is_handled: true,
        handled_by: actorUserId ? BigInt(actorUserId) : null,
        handled_at: new Date(),
        note: `Ответ на сообщение #${original.id}`,
      },
    });

    this.log.info("MAX-бот: отправлен ответ", {
      inbox_id: String(original.id),
      max_user_id: String(original.max_user_id),
      text_length: message.length,
    });

    return mapInboxRow(created);
  }

  /** GET /api/admin/max-bot/audiences/preview */
  async previewAudience({ audience, sampleLimit = AUDIENCE_PREVIEW_SAMPLE } = {}) {
    const parsed = parseMaxBotAudience(audience);

    const [count, sample] = await Promise.all([
      countMaxBotAudience(this.db, parsed),
      resolveMaxBotAudience(this.db, parsed, { limit: sampleLimit }),
    ]);

    return {
      audience: parsed.raw,
      description: describeMaxBotAudience(parsed),
      count,
      sample,
    };
  }

  /**
   * POST /api/admin/max-bot/webhook/setup
   * Регистрация webhook вместо long polling — только по явному действию админа.
   */
  async setupWebhook({ url, secret, updateTypes }) {
    if (!this.service.isConfigured()) {
      throw new ValidationError("MAX_BOT_TOKEN не задан — регистрация webhook невозможна");
    }

    if (typeof url !== "string" || !url.trim()) {
      throw new ValidationError("Не указан webhook URL");
    }

    const result = await this.service.subscribeWebhook(
      url.trim(),
      typeof secret === "string" ? secret.trim() : null,
      Array.isArray(updateTypes) && updateTypes.length
        ? updateTypes.map((t) => String(t))
        : ["message_created", "bot_started"]
    );

    this.log.info("MAX-бот: webhook зарегистрирован", { url });

    return { url, result };
  }

  /** Возвращает строку сообщения из ленты или бросает 404. */
  async _requireInboxRow(id) {
    if (!/^\d+$/.test(String(id ?? ""))) {
      throw new ValidationError("Некорректный id сообщения");
    }

    const row = await this.db.maxBotInboxMessage.findUnique({
      where: { id: BigInt(id) },
    });

    if (!row) {
      throw new NotFoundError("Сообщение не найдено");
    }

    return row;
  }
}

export default MaxBotAdminUseCases;
