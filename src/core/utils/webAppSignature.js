import crypto from "crypto";

/**
 * Проверка подписи WebAppData мини-приложений (Telegram и MAX).
 *
 * Оба клиента документируют один и тот же формат: `initData` — это
 * `key=value&key=value`, где `hash` = hex(HMAC-SHA256(secret_key,
 * data_check_string)), а `data_check_string` — все поля кроме `hash`,
 * декодированные, отсортированные по имени и склеенные через `\n`.
 *
 * ДВА кандидата на `secret_key` проверяются оба, и в результат кладётся отметка,
 * какой сработал: документация Telegram записывает формулу как
 * `HMAC_SHA256(<bot_token>, "WebAppData")` и не расшифровывает порядок
 * аргументов, а часть SDK-ов использует `SHA256(bot_token)` как ключ. Это
 * период определения, а не совместимость: у первого же успешного входа в
 * Telegram-мини-аппе второй кандидат удаляется (см.
 * `docs/backend-refactor-heavy-files-2026-09.md`, задача H9.2).
 *
 * Значения `initData`, ключи и `hash` в логи не пишутся: перехват подписанного
 * `initData` в чужом логе был бы готовым логином в окно `auth_date`.
 */
const WEB_APP_DATA = "WebAppData";

const decodeOnce = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
};

const parsePairs = (initData) => {
  const params = [];
  const seenKeys = new Set();

  for (const pair of String(initData).split("&")) {
    if (!pair) {
      continue;
    }

    const separator = pair.indexOf("=");

    if (separator <= 0) {
      return { error: "malformed_pair" };
    }

    const key = pair.slice(0, separator);

    if (seenKeys.has(key)) {
      return { error: "duplicate_key" };
    }

    seenKeys.add(key);
    params.push([key, pair.slice(separator + 1)]);
  }

  return { params };
};

const secretKeyVariants = (botToken) => [
  {
    id: "hmac-over-token",
    key: crypto.createHmac("sha256", WEB_APP_DATA).update(botToken).digest(),
  },
  {
    id: "hmac-over-sha256-token",
    key: crypto
      .createHmac("sha256", crypto.createHash("sha256").update(botToken).digest())
      .update(WEB_APP_DATA)
      .digest(),
  },
];

const buildDataCheckString = (decodedParams) =>
  decodedParams
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

/**
 * @param {string} initData строка WebAppData (`auth_date=…&user=…&hash=…`)
 * @param {string} botToken токен того бота, чей мини-апп открыт
 * @returns {{valid: boolean, user: object|null, authDate: number|null,
 *   reason: string, keyVariant: string|null}}
 */
export const verifyWebAppInitData = (initData, botToken) => {
  const empty = (reason) => ({ valid: false, user: null, authDate: null, reason, keyVariant: null });

  if (typeof initData !== "string" || !initData.trim()) {
    return empty("empty");
  }

  if (typeof botToken !== "string" || !botToken.trim()) {
    return empty("no_bot_token");
  }

  const parsed = parsePairs(initData);

  if (parsed.error) {
    return empty(parsed.error);
  }

  const hashEntries = parsed.params.filter(([key]) => key === "hash");

  if (hashEntries.length !== 1) {
    return empty("missing_hash");
  }

  const originalHash = decodeOnce(hashEntries[0][1]).trim();

  if (!/^[a-f0-9]{64}$/i.test(originalHash)) {
    return empty("invalid_hash_format");
  }

  const decodedParams = parsed.params.map(([key, value]) => [key, decodeOnce(value)]);
  const dataCheckString = buildDataCheckString(decodedParams);
  const received = Buffer.from(originalHash.toLowerCase(), "hex");

  let keyVariant = null;

  for (const candidate of secretKeyVariants(botToken)) {
    const calculated = crypto
      .createHmac("sha256", candidate.key)
      .update(dataCheckString)
      .digest();

    // Разная длина — пропускаем: timingSafeEqual на неравных буферах бросает.
    if (calculated.length === received.length && crypto.timingSafeEqual(calculated, received)) {
      keyVariant = candidate.id;
      break;
    }
  }

  const userRaw = decodedParams.find(([key]) => key === "user")?.[1];
  const authDateRaw = decodedParams.find(([key]) => key === "auth_date")?.[1];

  let user = null;

  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  const authDate = Number(authDateRaw);

  return {
    valid: keyVariant !== null,
    user,
    authDate: Number.isFinite(authDate) ? authDate : null,
    reason: keyVariant ? `ok:${keyVariant}` : "hash_mismatch",
    keyVariant,
  };
};
