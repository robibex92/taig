import { prisma } from "../database/prisma.js";
import { logger } from "../../core/utils/logger.js";
import { maxBotService as defaultService } from "./MaxBotService.js";
import {
  MAX_BOT_INBOX_DIRECTION,
  MAX_BOT_STATE_KEYS,
} from "../../core/constants/maxBot.js";
import { extractPayloadMarker, parseMaxUpdatesPayload } from "../../core/utils/maxBotEvents.js";

const POLL_TIMEOUT_MS = 25000;
const POLL_LIMIT = 50;
const ERROR_RETRY_DELAY_MS = 5000;
/** Если MAX ответил быстрее этой границы — считаем, что long polling не держится, и делаем паузу. */
const FAST_RESPONSE_MS = 1000;
/** Дедупликация событий без marker: то же сообщение того же автора в этом окне считается повтором. */
const MARKERLESS_DEDUPE_WINDOW_MS = 2 * 60 * 1000;

const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Сборщик входящих сообщений MAX-бота (long polling `GET /updates`).
 *
 * ЗАЧЕМ: админка должна показывать «что написали жители и кто именно»,
 * поэтому каждое событие `message_created` кладётся в `max_bot_inbox_messages`
 * с привязкой к локальному аккаунту по `users.max_id`.
 *
 * КУРСОР: значение `marker` из ответа сохраняется в `max_bot_state`
 * (ключ `updates_marker`) и переживает перезапуск процесса. Дедупликация — по
 * уникальному полю `max_bot_inbox_messages.marker`.
 *
 * АЛЬТЕРНАТИВА — WEBHOOK. Вместо поллинга MAX умеет сам присылать события:
 *   POST /subscriptions  { url, update_types: ["message_created","bot_started"], secret }
 * Переключение:
 *   1) задать `MAX_BOT_POLLING=false` (поллер не стартует в src/server.js);
 *   2) нажать в админке «Настроить webhook» (POST /api/admin/max-bot/webhook/setup)
 *      или вызвать `maxBotService.subscribeWebhook(url, secret)`;
 *   3) принять события на публичный HTTP-эндпоинт и передать их в
 *      `poller.persistIncoming(parseMaxUpdatesPayload(body, { botUserId }))` —
 *      вся логика сохранения/дедупликации здесь уже вынесена в отдельный метод.
 * По умолчанию используется polling, потому что он не требует публичного URL
 * и работает на dev-машинах.
 */
export class MaxBotUpdatePoller {
  constructor({
    db = prisma,
    service = defaultService,
    loggerImpl,
    pollTimeoutMs = POLL_TIMEOUT_MS,
    limit = POLL_LIMIT,
    errorRetryDelayMs = ERROR_RETRY_DELAY_MS,
  } = {}) {
    this.db = db;
    this.service = service;
    this.log = loggerImpl ?? logger;
    this.pollTimeoutMs = pollTimeoutMs;
    this.limit = limit;
    this.errorRetryDelayMs = errorRetryDelayMs;

    this.running = false;
    this.stopping = false;
    this.cursor = null;
    this.botUserId = null;
    /** max_id -> user_id, чтобы не дёргать БД на каждое сообщение. */
    this.userCache = new Map();
    this.loopPromise = null;
    this.stats = { polls: 0, stored: 0, duplicates: 0, errors: 0 };
  }

  isRunning() {
    return this.running;
  }

  /** Запуск цикла. Без токена или с уже запущенным циклом — no-op с внятным логом. */
  start() {
    if (this.running) return false;

    if (!this.service.isConfigured()) {
      this.log.warn("MAX-бот: поллер не запущен — MAX_BOT_TOKEN не задан");
      return false;
    }

    this.running = true;
    this.stopping = false;
    this.loopPromise = this._loop();
    this.log.info("MAX-бот: поллер входящих сообщений запущен");
    return true;
  }

  /** Остановка: ждём завершения текущей итерации (с таймаутом). */
  async stop({ timeoutMs = POLL_TIMEOUT_MS + 5000 } = {}) {
    if (!this.running) return;

    this.stopping = true;
    this.log.info("MAX-бот: останавливаю поллер");

    if (this.loopPromise) {
      await Promise.race([this.loopPromise, sleep(timeoutMs)]);
    }

    this.running = false;
    this.loopPromise = null;
    this.userCache.clear();
  }

  async _loop() {
    await this._loadInitialState();

    while (!this.stopping) {
      const startedAt = Date.now();

      try {
        const payload = await this.service.getUpdates({
          after: this.cursor,
          timeoutMs: this.pollTimeoutMs,
          limit: this.limit,
        });

        const incoming = parseMaxUpdatesPayload(payload, { botUserId: this.botUserId });
        this.stats.polls += 1;

        if (incoming.length) {
          const { stored, duplicates } = await this.persistIncoming(incoming);
          this.log.info("MAX-бот: обработаны входящие события", {
            events: incoming.length,
            stored,
            duplicates,
          });
        }

        const marker = extractPayloadMarker(payload);
        if (marker && (!this.cursor || BigInt(marker) > BigInt(this.cursor))) {
          await this._saveCursor(marker);
        }

        if (this.stopping) break;

        // Long polling обычно держит соединение; если ответ пришёл мгновенно —
        // небольшая пауза, чтобы нежечь CPU и не долбить API.
        const elapsed = Date.now() - startedAt;
        if (elapsed < FAST_RESPONSE_MS) {
          await sleep(FAST_RESPONSE_MS - elapsed);
        }
      } catch (error) {
        this.stats.errors += 1;
        this.log.error("MAX-бот: ошибка поллинга", { error: error.message });
        await sleep(this.errorRetryDelayMs);
      }
    }

    this.running = false;
    this.log.info("MAX-бот: поллер остановлен", { ...this.stats });
  }

  /** Курсор из БД + id самого бота (чтобы отсекать его собственные сообщения). */
  async _loadInitialState() {
    try {
      const state = await this.db.maxBotState.findUnique({
        where: { key: MAX_BOT_STATE_KEYS.UPDATES_MARKER },
      });
      if (state?.value && /^\d+$/.test(state.value)) {
        this.cursor = state.value;
        this.log.info("MAX-бот: курсор восстановлен", { cursor: this.cursor });
      }
    } catch (error) {
      this.log.warn("MAX-бот: курсор не читается, начинаем с нуля", { error: error.message });
    }

    try {
      const me = await this.service.getMe();
      const info = me?.payload ?? me ?? {};
      if (info.user_id !== undefined && info.user_id !== null) {
        this.botUserId = String(info.user_id);
      }
      this.log.info("MAX-бот: подписка на обновления", {
        bot: info.username ? `@${info.username}` : info.first_name ?? null,
      });
    } catch (error) {
      this.log.warn("MAX-бот: GET /me не удался, события бота фильтруются по is_bot", {
        error: error.message,
      });
    }
  }

  async _saveCursor(marker) {
    this.cursor = String(marker);

    try {
      await this.db.maxBotState.upsert({
        where: { key: MAX_BOT_STATE_KEYS.UPDATES_MARKER },
        create: { key: MAX_BOT_STATE_KEYS.UPDATES_MARKER, value: this.cursor },
        update: { value: this.cursor },
      });
    } catch (error) {
      this.log.error("MAX-бот: не удалось сохранить курсор", { error: error.message });
    }
  }

  /**
   * Сохранение нормализованных входящих сообщений с дедупликацией.
   * Вызывается и из поллинга, и (в webhook-режиме) из обработчика подписки.
   */
  async persistIncoming(incoming = []) {
    let stored = 0;
    let duplicates = 0;

    for (const item of incoming) {
      const saved = await this._persistOne(item);
      if (saved) stored += 1;
      else duplicates += 1;
    }

    this.stats.stored += stored;
    this.stats.duplicates += duplicates;

    return { stored, duplicates };
  }

  async _persistOne(item) {
    if (!item?.max_user_id || !item?.text) return false;

    const maxUserId = BigInt(item.max_user_id);
    const marker = item.marker ? BigInt(item.marker) : null;
    const user = await this._matchUser(maxUserId);

    try {
      if (marker) {
        const existing = await this.db.maxBotInboxMessage.findUnique({ where: { marker } });
        if (existing) return false;
      } else {
        const duplicate = await this._findMarkerlessDuplicate(maxUserId, item.text);
        if (duplicate) return false;
      }

      await this.db.maxBotInboxMessage.create({
        data: {
          direction: MAX_BOT_INBOX_DIRECTION.IN,
          max_user_id: maxUserId,
          user_id: user?.user_id ?? null,
          display_name: item.display_name ?? user?.first_name ?? null,
          username: item.username ?? user?.username ?? null,
          text: item.text,
          marker,
        },
      });

      return true;
    } catch (error) {
      // Unique-конфликт по marker — это нормальная повторная доставка события
      if (error?.code === "P2002" || error?.code?.startsWith?.("23")) {
        return false;
      }
      this.log.error("MAX-бот: событие не сохранено", {
        max_user_id: item.max_user_id,
        error: error.message,
      });
      return false;
    }
  }

  async _findMarkerlessDuplicate(maxUserId, text) {
    const since = new Date(Date.now() - MARKERLESS_DEDUPE_WINDOW_MS);

    return this.db.maxBotInboxMessage.findFirst({
      where: {
        direction: MAX_BOT_INBOX_DIRECTION.IN,
        max_user_id: maxUserId,
        text,
        received_at: { gte: since },
      },
      select: { id: true },
    });
  }

  /** max_id -> локальный аккаунт (кэшируется на время жизни поллера). */
  async _matchUser(maxUserId) {
    const key = String(maxUserId);

    if (this.userCache.has(key)) return this.userCache.get(key);

    let user = null;
    try {
      user = await this.db.user.findUnique({
        where: { max_id: maxUserId },
        select: { user_id: true, username: true, first_name: true },
      });
    } catch (error) {
      this.log.warn("MAX-бот: не удалось сопоставить пользователя", {
        max_user_id: key,
        error: error.message,
      });
    }

    this.userCache.set(key, user);
    return user;
  }
}

export default MaxBotUpdatePoller;
