/**
 * Парсинг событий MAX Bot API (long polling `GET /updates` и webhook-полезная
 * нагрузка `POST /subscriptions`).
 *
 * MAX не даёт стабильно задокументированной формы события: в реальных ответах
 * бот получал текст/автора то на верхнем уровне, то в `message.data`, то в
 * `hints.user` / `message.repliers`. Поэтому здесь собран «широкий» читатель:
 * любые известные варианты форм, всегда с одним нормализованным результатом.
 *
 * Нормализованное входящее сообщение:
 *   {
 *     max_user_id: string | null,  // id собеседника в MAX (строка — из-за BigInt)
 *     text: string,
 *     display_name: string | null,
 *     username: string | null,
 *     marker: string | null,       // курсор события (для дедупликации)
 *     update_type: string | null,
 *   }
 *
 * События, автором которых является сам бот (свои рассылки/ответы), отбрасываются —
 * иначе inbox зациклится на собственных сообщениях.
 */

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const asIdString = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return null;
};

const truthy = (value) => value === true || value === "true" || value === 1 || value === "1";

/**
 * `GET /updates` отдаёт `{ updates: [...], marker }`, webhook может прислать
 * один объект события или обёртку `{ events: [...] }`.
 */
export const extractUpdateList = (payload) => {
  if (Array.isArray(payload)) return payload;

  const obj = asObject(payload);
  if (!obj) return [];

  const list =
    (Array.isArray(obj.updates) && obj.updates) ||
    (Array.isArray(obj.events) && obj.events) ||
    (Array.isArray(obj.result) && obj.result) ||
    (Array.isArray(obj.data) && obj.data) ||
    null;

  if (list) return list;

  // Одиночное событие
  if (obj.update_type || obj.type || obj.event || obj.event_type || obj.message) return [obj];

  return [];
};

export const getUpdateType = (update) => {
  const obj = asObject(update);
  if (!obj) return null;
  return firstString(obj.update_type, obj.type, obj.event, obj.event_type)?.toLowerCase() || null;
};

/** Курсор конкретного события: он же ключ дедупликации в БД. */
export const getUpdateMarker = (update) => {
  const obj = asObject(update);
  if (!obj) return null;
  return asIdString(obj.marker ?? obj.update_id ?? obj.seq ?? obj.id);
};

const collectUserCandidates = (update, message) => {
  const candidates = [];

  const push = (value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => candidates.push(item));
      return;
    }
    candidates.push(value);
  };

  // Плоские варианты: `{ user_id, text }` прямо в сообщении или в событии
  push(message);
  push(update);
  push(asObject(message)?.user);
  push(asObject(message)?.data?.user);
  push(asObject(message)?.from);
  push(asObject(message)?.repliers);
  push(asObject(asObject(message)?.hints)?.user);
  push(asObject(update)?.user);
  push(asObject(update)?.data?.user);
  push(asObject(update)?.from);
  push(asObject(update)?.repliers);
  push(asObject(asObject(update)?.hints)?.user);

  return candidates.filter(Boolean);
};

const collectTextCandidates = (update, message) => [
  asObject(message)?.text,
  asObject(message)?.data?.text,
  asObject(message)?.body,
  asObject(message)?.content,
  asObject(message)?.data?.body,
  asObject(update)?.text,
  asObject(update)?.data?.text,
  asObject(update)?.data?.message?.text,
];

/**
 * Id автора из одного кандидата.
 * `id` принимаем только если объект похож на профиль пользователя и не похож на
 * событие/сообщение — иначе можно записать автора по `id` самого события.
 */
const authorIdOf = (candidate) => {
  const direct = asIdString(candidate.user_id ?? candidate.uid ?? candidate.max_user_id);
  if (direct) return direct;

  const nested = asObject(candidate.user);
  const fromNested = nested ? asIdString(nested.user_id ?? nested.uid ?? nested.id) : null;
  if (fromNested) return fromNested;

  const looksLikeProfile =
    candidate.id !== undefined &&
    (candidate.first_name !== undefined ||
      candidate.username !== undefined ||
      candidate.name !== undefined ||
      candidate.is_bot !== undefined);

  const looksLikeEventOrMessage =
    candidate.text !== undefined ||
    candidate.message !== undefined ||
    candidate.update_type !== undefined ||
    candidate.data !== undefined;

  if (looksLikeProfile && !looksLikeEventOrMessage) {
    return asIdString(candidate.id);
  }

  return null;
};

/**
 * Автор события + признак «это сам бот».
 * Берётся первый кандидат с числовым id; `is_bot` ищет по всем кандидатам,
 * потому что флаги и id нередко лежат в разных узлах payload'а.
 */
const resolveAuthor = (update, message, { botUserId } = {}) => {
  const candidates = collectUserCandidates(update, message).map((c) => asObject(c)).filter(Boolean);

  let authorId = null;
  let displayName = null;
  let username = null;
  let isBot = false;

  for (const candidate of candidates) {
    const id = authorIdOf(candidate);
    const nested = asObject(candidate.user);

    if (!authorId && id) authorId = id;

    displayName =
      displayName ||
      firstString(
        candidate.display_name,
        candidate.displayName,
        candidate.first_name,
        candidate.name,
        nested?.first_name,
        nested?.name
      );
    username = username || firstString(candidate.username, nested?.username);
    isBot =
      isBot ||
      truthy(candidate.is_bot ?? candidate.isBot ?? nested?.is_bot) ||
      firstString(candidate.type, candidate.sender_type) === "bot";
  }

  if (botUserId && authorId && authorId === asIdString(botUserId)) isBot = true;

  return { authorId, displayName, username, isBot };
};

/**
 * Одно событие -> нормализованное входящее сообщение (или null, если событие
 * не «сообщение от человека»).
 */
export const parseMaxUpdate = (update, options = {}) => {
  const obj = asObject(update);
  if (!obj) return null;

  const type = getUpdateType(obj);
  // Нас интересуют только message_created (и его вариации вида message_created.bot);
  // bot_started / command_started и прочее в inbox не пишем.
  if (type && !type.includes("message")) {
    return null;
  }

  const rawMessage = obj.message ?? obj.data?.message ?? obj.messages?.[0] ?? obj.body;
  const message = typeof rawMessage === "string" ? { text: rawMessage } : asObject(rawMessage);

  const text = firstString(...collectTextCandidates(obj, message));
  if (!text) return null;

  const { authorId, displayName, username, isBot } = resolveAuthor(obj, message, options);
  if (isBot) return null; // собственный ответ бота в inbox не пишем
  if (!authorId) return null; // без автора писать некому

  return {
    max_user_id: authorId,
    text,
    display_name: displayName,
    username,
    marker: getUpdateMarker(obj),
    update_type: type,
  };
};

/**
 * Весь ответ `GET /updates` (или webhook body) -> список входящих сообщений.
 * Повторяющиеся внутри одного ответа marker'ы отбрасываются: MAX перевыставляет
 * одно и то же событие при догоне курсора. Глобальная дедупликация — уже на
 * сохранении (уникальный индекс по `marker`).
 */
export const parseMaxUpdatesPayload = (payload, options = {}) => {
  const incoming = [];
  const seenMarkers = new Set();

  for (const update of extractUpdateList(payload)) {
    const parsed = parseMaxUpdate(update, options);
    if (!parsed) continue;

    if (parsed.marker) {
      if (seenMarkers.has(parsed.marker)) continue;
      seenMarkers.add(parsed.marker);
    }

    incoming.push(parsed);
  }

  return incoming;
};

/** Максимальный marker во всём ответе — им и продвигаем курсор. */
export const extractPayloadMarker = (payload) => {
  const obj = asObject(payload);
  const top = asIdString(obj?.marker ?? obj?.last_marker ?? obj?.update_marker);

  const nested = extractUpdateList(payload)
    .map((update) => getUpdateMarker(update))
    .filter(Boolean)
    .map((value) => BigInt(value));

  let max = top ? BigInt(top) : null;
  for (const value of nested) {
    if (max === null || value > max) max = value;
  }

  return max === null ? null : max.toString();
};

export default { parseMaxUpdate, parseMaxUpdatesPayload, extractPayloadMarker };
