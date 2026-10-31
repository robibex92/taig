import { prisma } from "../database/prisma.js";
import { logger } from "../../core/utils/logger.js";
import { maxBotService as defaultService } from "./MaxBotService.js";
import defaultChatRepository from "../repositories/MaxChatRepository.js";
import defaultAutoReplies from "../../application/services/ChatAutoReplyService.js";
import { CHAT_BOT_PLATFORM } from "../../core/utils/chatAutoReply.js";
import {
  MAX_BOT_INBOX_DIRECTION,
  MAX_BOT_STATE_KEYS,
} from "../../core/constants/maxBot.js";
import { extractPayloadMarker, extractMaxLoginRequests, parseMaxUpdatesPayload } from "../../core/utils/maxBotEvents.js";
import { frontendEntry } from "../../core/utils/frontendUrl.js";

const POLL_TIMEOUT_MS = 25000;
const POLL_LIMIT = 50;
const ERROR_RETRY_DELAY_MS = 5000;
/** Если MAX ответил быстрее этой границы — считаем, что long polling не держится, и делаем паузу. */
const FAST_RESPONSE_MS = 1000;
/** Дедупликация событий без marker: то же сообщение того же автора в этом окне считается повтором. */
const MARKERLESS_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
/** Реестр чатов читаем не на каждое сообщение чата. */
const CHAT_CACHE_TTL_MS = 60_000;

/**
 * Ответ бота после подтверждения входа с сайта.
 *
 * Ссылка с одноразовым кодом — главный способ добрать вход на телефоне: пока
 * человек подтверждает в MAX, вкладка сайта фоновая, её опрос засыпается, и
 * забирать сессию становится некому. Тап по ссылке открывает сайт с
 * `?max_login=`, и фронт обменивает код сам — жива та вкладка или нет.
 */
const loginConfirmedText = (code) =>
  code
    ? `✅ Вход подтверждён. Откройте сайт по ссылке — он войдёт сам:\n${frontendEntry(`max_login=${code}`)}`
    : "✅ Вход подтверждён. Вернитесь во вкладку сайта — она авторизуется сама.";

const LOGIN_REJECTED_TEXT =
  "Код входа из ссылки не подошёл. Нажмите «Войти через MAX» на сайте и перейдите по ссылке, которую он откроет, — код в ней длинный и одноразовый.";

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
 *
 * ВТОРАЯ ЗАДАЧА ПОЛЛЕРА — автоответы в групповых чатах. Сообщение из чата,
 * который есть в реестре `max_chats` (включён и не `DIALOG`), в inbox не
 * пишется: там обращения жителей лично боту. Такое сообщение отдаётся
 * `ChatAutoReplyService`, и если текст подошёл под условие — в чат уходит
 * ответ админской фразы. Чата нет в реестре — считаем его диалогом и сохраняем,
 * как раньше: реестр и есть разрешение отвечать в группе.
 *
 * ОТВЕЧАЕМ ТОЛЬКО НА НОВЫЕ СООБЩЕНИЯ. Порог — отдельный курсор
 * `chat_reply_marker`: MAX отдаёт и то, что накопилось, пока процесс был
 * остановлен, а повторный ответ на вчерашнее сообщение — это не забота, а спам.
 * Диалоги сохраняются как раньше: обращение жителя, пришедшее во время простоя,
 * админ должен видеть, но в чат бот пишет строго с момента своего запуска.
 */
export class MaxBotUpdatePoller {
  constructor({
    db = prisma,
    service = defaultService,
    loggerImpl,
    loginConfirmation = null,
    chatRepository = defaultChatRepository,
    autoReplies = defaultAutoReplies,
    pollTimeoutMs = POLL_TIMEOUT_MS,
    limit = POLL_LIMIT,
    errorRetryDelayMs = ERROR_RETRY_DELAY_MS,
  } = {}) {
    this.db = db;
    this.service = service;
    this.log = loggerImpl ?? logger;
    /** `AuthenticateMaxUserUseCase`: вход с сайта подтверждается в чате бота. */
    this.loginConfirmation = loginConfirmation;
    /** Реестр `max_chats`: какие чаты считаются групповыми. */
    this.chats = chatRepository;
    this.autoReplies = autoReplies;
    this.pollTimeoutMs = pollTimeoutMs;
    this.limit = limit;
    this.errorRetryDelayMs = errorRetryDelayMs;

    this.running = false;
    this.stopping = false;
    this.cursor = null;
    /** Максимум уже рассмотренных для автоответа событий; null — порог не выставлен. */
    this.replyMarker = null;
    this.botUserId = null;
    /** max_id -> user_id, чтобы не дёргать БД на каждое сообщение. */
    this.userCache = new Map();
    /** chat_id -> запись реестра, тот же смысл: сообщения в чатах идут потоком. */
    this.chatCache = new Map();
    this.loopPromise = null;
    this.stats = {
      polls: 0,
      stored: 0,
      duplicates: 0,
      errors: 0,
      chatReplies: 0,
      chatSkipped: 0,
    };
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

        // Один и тот же маркер ответа нужен и для порога автоответов, и для
        // продвижения курсора — отдельного запроса к MAX ради него нет.
        const marker = extractPayloadMarker(payload);

        // Подтверждение входа с сайта читается из того же ответа /updates.
        await this._processLoginRequests(payload);

        let considered = [];

        if (incoming.length) {
          const { dialogs, groupMessages } = await this._splitByChat(incoming);
          const { fresh, stale } = this._newGroupMessages(groupMessages);

          for (const message of fresh) {
            await this._handleGroupMessage(message);
          }

          this.stats.chatSkipped += stale.length;
          considered = [...fresh, ...stale];

          if (stale.length) {
            // info, не debug: по этой строке видно, что поллер чат видит, но
            // сознательно в нём молчит. Иначе «бот не отвечает» нечем проверить.
            this.log.info("MAX-бот: сообщения чата пропущены как не новые", {
              count: stale.length,
              reason: this.replyMarker ? "stale" : "baseline",
            });
          }

          if (dialogs.length) {
            const { stored, duplicates } = await this.persistIncoming(dialogs);
            this.log.info("MAX-бот: обработаны входящие события", {
              events: incoming.length,
              stored,
              duplicates,
              chats: groupMessages.length,
            });
          }
        }

        await this._advanceReplyMarker(marker, considered);

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

  /** Курсоры из БД + id самого бота (чтобы отсекать его собственные сообщения). */
  async _loadInitialState() {
    try {
      const rows = await this.db.maxBotState.findMany({
        where: {
          key: {
            in: [MAX_BOT_STATE_KEYS.UPDATES_MARKER, MAX_BOT_STATE_KEYS.CHAT_REPLY_MARKER],
          },
        },
      });
      const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

      const cursor = values[MAX_BOT_STATE_KEYS.UPDATES_MARKER];
      if (cursor && /^\d+$/.test(cursor)) {
        this.cursor = cursor;
        this.log.info("MAX-бот: курсор восстановлен", { cursor: this.cursor });
      }

      const replyMarker = values[MAX_BOT_STATE_KEYS.CHAT_REPLY_MARKER];
      if (replyMarker && /^\d+$/.test(replyMarker)) {
        this.replyMarker = replyMarker;
      } else {
        // Первый запуск: порога нет, поэтому накопленный backlog чата в расчёт
        // не пойдёт и отвечать бот начнёт со следующего нового сообщения.
        this.log.info("MAX-бот: автоответы включаются с новых сообщений, история чата игнорируется");
      }
    } catch (error) {
      this.log.warn("MAX-бот: курсоры не читаются, начинаем с нуля", { error: error.message });
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

  /**
   * Сообщения зарегистрированных чатов, на которые вообще допустимо ответить.
   *
   * Порог — `replyMarker`: событие обязано быть строго новее него. Без порога
   * (самый первый поллинг после запуска) не берётся ничего: в первом ответе MAX
   * отдаёт накопленный backlog чата, а отвечать на вчерашние сообщения — ровно
   * то, чего админ не ждал. Порог ставится по этому же ответу, поэтому дальше
   * бот видит только свежие сообщения.
   *
   * Событие без маркера тоже не берётся: по нему невозможно отличить новое
   * сообщение от повторной доставки уже отвеченного.
   */
  _newGroupMessages(groupMessages) {
    const threshold = this.replyMarker ? BigInt(this.replyMarker) : null;
    const fresh = [];
    const stale = [];

    for (const item of groupMessages) {
      const marker = item.marker ? BigInt(item.marker) : null;
      const isNew = threshold !== null && marker !== null && marker > threshold;

      if (isNew) fresh.push(item);
      else stale.push(item);
    }

    return { fresh, stale };
  }

  /**
   * Новый порог «что уже рассмотрено» — максимум из маркера ответа MAX и
   * маркеров просмотренных событий. Продвигается и при пустом ответе: первый же
   * маркер означает «всё ниже него мы больше не рассматриваем».
   */
  async _advanceReplyMarker(payloadMarker, considered = []) {
    const previous = this.replyMarker ? BigInt(this.replyMarker) : null;
    let next = previous;

    const bump = (value) => {
      if (!value) return;
      const candidate = BigInt(value);
      if (next === null || candidate > next) next = candidate;
    };

    bump(payloadMarker);
    for (const item of considered) bump(item.marker);

    if (next === null || (previous !== null && next === previous)) return;

    this.replyMarker = next.toString();

    try {
      await this.db.maxBotState.upsert({
        where: { key: MAX_BOT_STATE_KEYS.CHAT_REPLY_MARKER },
        create: { key: MAX_BOT_STATE_KEYS.CHAT_REPLY_MARKER, value: this.replyMarker },
        update: { value: this.replyMarker },
      });
    } catch (error) {
      this.log.error("MAX-бот: порог автоответов не сохранён", { error: error.message });
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
   * Диалог или зарегистрированный групповой чат.
   *
   * Признак — наличие чата в реестре `max_chats`: у MAX id чата есть и у личных
   * диалогов (`recipient.chat_id`), так что по одному только id различить их
   * нельзя. Реестр при этом и есть разрешение: бот отвечает только там, где его
   * показал админ, и не начинает писать в чужую группу сам.
   */
  async _splitByChat(incoming) {
    const dialogs = [];
    const groupMessages = [];

    for (const item of incoming) {
      const chat = item.chat_id ? await this._chatRow(item.chat_id) : null;

      if (chat) groupMessages.push({ ...item, chat });
      else dialogs.push(item);
    }

    return { dialogs, groupMessages };
  }

  async _chatRow(chatId) {
    const key = String(chatId);
    const cached = this.chatCache.get(key);

    if (cached && cached.expiresAt > Date.now()) return cached.chat;

    let chat = null;

    try {
      const found = await this.chats.findByChatId(key);

      if (found?.is_active && found.chat_type !== "DIALOG") chat = found;
    } catch (error) {
      this.log.warn("MAX-бот: реестр чатов не прочитан", { chat_id: key, error: error.message });
    }

    this.chatCache.set(key, { chat, expiresAt: Date.now() + CHAT_CACHE_TTL_MS });

    return chat;
  }

  /** Сообщение из группового чата: условие автоответа, если текст подошёл. */
  async _handleGroupMessage(item) {
    const { sent, phrase } = await this.autoReplies.handleChatMessage({
      platform: CHAT_BOT_PLATFORM.MAX,
      chatLabel: String(item.chat.chat_id),
      text: item.text,
      send: (response) => this.service.sendChatMessage(String(item.chat.chat_id), response),
    });

    if (sent) this.stats.chatReplies += 1;

    // info и при отсутствии совпадения: по этой строке видно, что MAX вообще
    // доставляет боту сообщения чата, — иначе про факт доставки судить нечем.
    this.log.info("MAX-бот: сообщение из зарегистрированного чата", {
      chat_id: String(item.chat.chat_id),
      chat_name: item.chat.name,
      matched: Boolean(phrase),
      sent,
    });
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

  /**
   * MAX-бот как подтверждение входа на сайт: событие `bot_started` (или
   * сообщение `/start login_…`) привязывает автора к одноразовому `requestId`,
   * и в чат уходит ответ со ссылкой `?max_login=<code>`. Сайт забирает сессию
   * либо своим поллингом `POST /api/auth/max/claim`, либо тапом по ссылке —
   * второе работает и когда вкладка за время подтверждения уснула.
   *
   * Мини-апп для этого не нужен: на десктопном клиенте MAX не отдаёт подпись
   * `WebAppData`, поэтому путь «подтвердить в мини-аппе» там непроходим, а
   * автор события подтверждён самим MAX.
   */
  async _processLoginRequests(payload) {
    if (!this.loginConfirmation) return;

    const { requests, observed } = extractMaxLoginRequests(payload, {
      botUserId: this.botUserId,
    });

    for (const event of observed) {
      // info, не debug: на проде LOG_LEVEL = info, и без этой строки неизвестную
      // форму события MAX пришлось бы угадывать следующей правкой.
      this.log.info("MAX-бот: start-событие без параметра входа", event);
    }

    for (const item of requests) {
      try {
        const { confirmed, code } = await this.loginConfirmation.confirmLoginFromBotUser(
          {
            id: item.max_user_id,
            username: item.username,
            first_name: item.display_name,
          },
          item.request_id
        );

        const sent = await this.service.sendMessage(
          item.max_user_id,
          confirmed ? loginConfirmedText(code) : LOGIN_REJECTED_TEXT
        );

        if (!sent.ok && !sent.skipped) {
          this.log.warn("MAX-бот: ответ о подтверждении входа не отправлен", {
            error: sent.error,
          });
        }
      } catch (error) {
        this.log.error("MAX-бот: вход с сайта не подтверждён", {
          max_user_id: item.max_user_id,
          error: error.message,
        });
      }
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
