import { logger } from "../../core/utils/logger.js";

/**
 * Клиент MAX Bot API (https://dev.max.ru/docs).
 *
 * Проверенное поведение live-бота:
 *  - авторизация ТОЛЬКО заголовком `Authorization: <MAX_BOT_TOKEN>`
 *    (токен в query-параметре деприкейчен и не работает);
 *  - `GET /me` -> `{ user_id, first_name, username, is_bot, description, avatar_url, last_activity_time }`;
 *  - `POST /messages?user_id=<maxUserId>` c телом `{"text": "..."}` -> 200,
 *    если у пользователя ЕСТЬ диалог с ботом;
 *    404 `{"code":"dialog.not.found","message":"Dialog not found"}` — диалога нет
 *    (типичный случай: житель ни разу не написал боту). Это НЕ ошибка доставки:
 *    получатель помечается как `skipped`;
 *  - `GET /updates?after=<cursor>&timeout=<ms>&limit=<n>` -> `{ updates: [], marker: <number> }`
 *    (long polling; `marker` — новый курсор);
 *  - `POST /subscriptions` `{ url, update_types, secret }` — альтернатива поллингу.
 *
 * BASE URL вынесен в `MAX_BOT_API_URL`, потому что на developer-машинах
 * `platform-api2.max.ru` не проходит TLS-валидацию, а `botapi.max.ru` отвечает
 * идентично (см. `.env.example` / `env.template`).
 *
 * Токен в логи не попадает никогда: логируются только путь, статус и размеры.
 */

export const MAX_BOT_DEFAULT_BASE_URL = "https://platform-api2.max.ru";
export const MAX_BOT_FALLBACK_BASE_URL = "https://botapi.max.ru";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class MaxBotApiError extends Error {
  constructor(message, { status = null, code = null, details = null } = {}) {
    super(message);
    this.name = "MaxBotApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJsonSafe = async (response) => {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
};

const describePayloadError = (payload, fallback) => {
  if (!payload) return fallback;
  const code = payload.code || payload.error?.code;
  const message = payload.message || payload.error?.message || payload.detail;
  if (code && message) return `${message} (${code})`;
  return message || code || fallback;
};

export class MaxBotService {
  constructor({
    token,
    baseUrl,
    fallbackBaseUrl,
    fetchImpl,
    timeoutMs,
    maxAttempts,
    retryBaseDelayMs,
    loggerImpl,
  } = {}) {
    this.token = token ?? process.env.MAX_BOT_TOKEN ?? null;

    const primary = String(
      baseUrl ?? process.env.MAX_BOT_API_URL ?? MAX_BOT_DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    const fallback = String(
      fallbackBaseUrl ?? process.env.MAX_BOT_API_URL_FALLBACK ?? MAX_BOT_FALLBACK_BASE_URL
    ).replace(/\/+$/, "");

    /**
     * Хосты в порядке приоритета. `platform-api2.max.ru` на части серверов не
     * проходит TLS-валидацию, а `botapi.max.ru` отдаёт то же самое, поэтому при
     * сетевом отказе переключаемся на резервный и держим его до перезапуска.
     * Резервный хост подключается только к URL по умолчанию: явно указавший свой
     * хост администратор знает, что он хочет, и подменять его не стоит.
     */
    const explicitFallback = fallbackBaseUrl ?? process.env.MAX_BOT_API_URL_FALLBACK ?? null;
    const useFallback = Boolean(explicitFallback) || primary === MAX_BOT_DEFAULT_BASE_URL;
    this.hosts =
      useFallback && fallback && fallback !== primary ? [primary, fallback] : [primary];
    this.hostIndex = 0;

    this.fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.timeoutMs = timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.maxAttempts = maxAttempts ?? MAX_ATTEMPTS;
    this.retryBaseDelayMs = retryBaseDelayMs ?? RETRY_BASE_DELAY_MS;
    this.log = loggerImpl ?? logger;
  }

  get baseUrl() {
    return this.hosts[this.hostIndex];
  }

  isConfigured() {
    return Boolean(this.token);
  }

  /** Без токена любой вызов — ошибка конфигурации, а не сети. */
  assertConfigured() {
    if (!this.isConfigured()) {
      throw new MaxBotApiError("MAX_BOT_TOKEN не задан — интеграция с MAX-ботом не настроена");
    }
  }

  /**
   * Один запрос к API с таймаутом (AbortController) и повторами на 429/5xx.
   * @returns {Promise<any>} разобранный JSON
   */
  async request(path, { method = "GET", query = null, body, timeoutMs } = {}) {
    this.assertConfigured();

    const buildUrl = () => {
      const url = new URL(`${this.baseUrl}${path}`);
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        });
      }
      return url;
    };

    const payloadText = body === undefined ? null : JSON.stringify(body);
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        timeoutMs ?? this.timeoutMs
      );

      try {
        const response = await this.fetchImpl(buildUrl().toString(), {
          method,
          headers: {
            Authorization: this.token,
            ...(payloadText ? { "Content-Type": "application/json" } : {}),
          },
          ...(payloadText ? { body: payloadText } : {}),
          signal: controller.signal,
        });

        const payload = await parseJsonSafe(response);

        if (response.ok) {
          if (attempt > 1) {
            this.log.info("MAX API: запрос успешен после повтора", {
              method,
              path,
              attempt,
            });
          }
          return payload ?? {};
        }

        const error = new MaxBotApiError(
          describePayloadError(payload, `MAX API ответил ${response.status}`),
          { status: response.status, code: payload?.code ?? payload?.error?.code ?? null, details: payload }
        );

        // 429/5xx — повторяем с экспоненциальной задержкой (учитываем Retry-After)
        if (RETRYABLE_STATUS.has(response.status) && attempt < this.maxAttempts) {
          const retryAfterSec = Number(response.headers?.get?.("retry-after"));
          const delay = Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? retryAfterSec * 1000
            : this.retryBaseDelayMs * 2 ** (attempt - 1);

          this.log.warn("MAX API: повторяю запрос", {
            method,
            path,
            status: response.status,
            attempt,
            delay_ms: delay,
          });

          lastError = error;
          await sleep(delay);
          continue;
        }

        this.log.error("MAX API: ошибка запроса", {
          method,
          path,
          status: response.status,
          code: error.code,
        });
        throw error;
      } catch (err) {
        if (err instanceof MaxBotApiError) throw err;

        const aborted = err?.name === "AbortError";
        lastError = new MaxBotApiError(
          aborted ? `MAX API: превышен таймаут запроса ${path}` : `MAX API: сетевая ошибка (${path})`,
          { status: null, code: aborted ? "timeout" : "network_error" }
        );

        // Сеть/TLS/DNS: возможно, винован конкретный хост, а не MAX в целом.
        if (!aborted && this.hostIndex < this.hosts.length - 1) {
          const failedHost = this.baseUrl;
          this.hostIndex += 1;
          this.log.warn("MAX API: переключаюсь на резервный хост", {
            method,
            path,
            from: failedHost,
            to: this.baseUrl,
            error: err?.message,
          });
          continue;
        }

        if (attempt < this.maxAttempts) {
          const delay = this.retryBaseDelayMs * 2 ** (attempt - 1);
          this.log.warn("MAX API: сетевой сбой, повторяю", {
            method,
            path,
            attempt,
            delay_ms: delay,
            error: err?.message,
          });
          await sleep(delay);
          continue;
        }

        this.log.error("MAX API: запрос не удался", {
          method,
          path,
          error: lastError.message,
        });
        throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new MaxBotApiError(`MAX API: запрос ${path} не выполнен`);
  }

  /** Информация о боте — используется экраном «Статус бота». */
  async getMe() {
    return this.request("/me");
  }

  /**
   * Отправка текста пользователю.
   * @returns {Promise<{ok: true, message_id: string|null} | {ok: false, skipped: boolean, error: string, code: string|null}>}
   *   `skipped: true` — у пользователя нет диалога с ботом (норма для большинства жителей).
   */
  async sendMessage(maxUserId, text) {
    const userId = String(maxUserId ?? "").trim();

    if (!userId) {
      return { ok: false, skipped: true, error: "У пользователя нет MAX ID", code: "no.max_id" };
    }
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, skipped: false, error: "Пустой текст сообщения", code: "empty.text" };
    }

    try {
      const payload = await this.request("/messages", {
        method: "POST",
        query: { user_id: userId },
        body: { text },
      });

      // MAX заворачивает ответы в `{ payload: ... }`, исторически встречались и
      // `{ result: ... }`, и плоский JSON — разбираем все три варианта.
      const result = payload?.result ?? payload?.payload ?? payload ?? {};
      const messageId =
        result.message_ids?.[0]?.message_id ??
        result.message_id ??
        result.id ??
        payload?.message_id ??
        null;

      return { ok: true, message_id: messageId === undefined ? null : String(messageId) };
    } catch (err) {
      const dialogMissing =
        err?.status === 404 && String(err?.code || "").includes("dialog.not.found");

      if (dialogMissing) {
        return {
          ok: false,
          skipped: true,
          error: "Нет диалога с ботом (житель не писал боту)",
          code: "dialog.not.found",
        };
      }

      return {
        ok: false,
        skipped: false,
        error: err?.message || "Ошибка MAX API",
        code: err?.code ?? null,
      };
    }
  }

  /**
   * Long polling событий.
   *
   * ВАЖНО (проверено на live): параметр `timeout` в MAX API измеряется в СЕКУНДАХ
   * и ограничен 90 — в миллисекундах сервер отвечает
   * `400 {"code":"proto.payload","message":"Field 'timeout' value (1500) must be at most 90"}`.
   *
   * @param {number|string|null} after    курсор (предыдущий `marker`)
   * @param {number} timeoutMs            сколько секунд сервер держит соединение (в ms для вызывающего кода)
   */
  async getUpdates({ after = null, timeoutMs = 25000, limit = 50 } = {}) {
    const timeoutSeconds = Math.max(1, Math.min(90, Math.round(Number(timeoutMs) / 1000) || 25));

    return this.request("/updates", {
      query: {
        ...(after === null || after === undefined || after === "" ? {} : { after }),
        timeout: timeoutSeconds,
        limit,
      },
      // таймаут HTTP-запроса должен быть больше серверного long-poll-таймаута
      timeoutMs: timeoutSeconds * 1000 + 10000,
    });
  }

  /**
   * Регистрация webhook вместо поллинга (`POST /subscriptions`).
   * Включается администратором вручную; по умолчанию используется polling.
   */
  async subscribeWebhook(url, secret, updateTypes = ["message_created", "bot_started"]) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      throw new MaxBotApiError("Некорректный webhook URL", { code: "webhook.url.invalid" });
    }

    return this.request("/subscriptions", {
      method: "POST",
      body: {
        url,
        update_types: updateTypes,
        ...(secret ? { secret } : {}),
      },
    });
  }
}

/** Единственный экземпляр для всего приложения (токен/URL читаются из env). */
export const maxBotService = new MaxBotService();

export default maxBotService;
