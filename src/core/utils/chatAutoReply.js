/**
 * Условия автоответа в чатах: общая нормализация и подбор ответа.
 *
 * Одно правило на оба канала (Telegram и MAX): фразу ищём в тексте после
 * приведения к нижнему регистру, замены ё на е и схлопывания пробелов. Так
 * «Телефон  УК» и «телефон ук» — одно и то же сочетание, а «телефон ук» внутри
 * «телефон укзамена» не срабатывает: границы слов обязательны.
 */

export const CHAT_BOT_PLATFORM = {
  TELEGRAM: "telegram",
  MAX: "max",
};

export const CHAT_BOT_PLATFORMS = Object.values(CHAT_BOT_PLATFORM);

/** Ответ бота не длиннее самого короткого лимита канала (MAX — 4000). */
export const CHAT_TRIGGER_RESPONSE_LIMIT = 4000;
export const CHAT_TRIGGER_PHRASE_LIMIT = 200;

export const normalizeTriggerText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Фраза — последовательность слов с любыми пробелами между ними, но обязательно
 * на границе слова: «телефон ук» не срабатывает на «телефон укзамена» и
 * срабатывает на «телефон ук?!».
 */
const phrasePattern = (normalizedPhrase) => {
  const body = normalizedPhrase
    .split(" ")
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s+");

  return new RegExp(`(^|[^\\p{L}\\p{N}])${body}($|[^\\p{L}\\p{N}])`, "u");
};

/**
 * Быстрый отсев перед поиском фразы: если первого её символа в тексте нет,
 * искать нечего. Фраза обязана встретиться целиком, поэтому её первая буква
 * (после той же нормализации, что и текст) обязана быть в тексте. Это дёшево
 * ровно там, где нужно: сообщения в чате идут потоком, условий может быть
 * десятки, а конструирование регулярки на каждое — самая дорогая часть проверки.
 */
const mayContainPhrase = (normalizedPhrase, normalizedText) =>
  normalizedText.includes(normalizedPhrase[0]);

/** Подошло ли условие тексту сообщения. */
export const triggerMatches = (phrase, text) => {
  const normalizedPhrase = normalizeTriggerText(phrase);
  const normalizedText = normalizeTriggerText(text);

  if (!normalizedPhrase || !normalizedText) return false;
  if (!mayContainPhrase(normalizedPhrase, normalizedText)) return false;

  return phrasePattern(normalizedPhrase).test(normalizedText);
};

/**
 * Бот отвечает только на свежие сообщения.
 *
 * Причина не косметическая: после рестарта процесса мессенджер отдаёт и то, что
 * накопилось за время отсутствия. Ответ на вчерашний вопрос «телефон УК»
 * выглядит как сбой, а не как забота. У MAX граница — маркер события (его ведёт
 * поллер), у Telegram — дата сообщения, её читает этот хелпер.
 */
export const CHAT_MESSAGE_FRESH_MS = 5 * 60 * 1000;

/**
 * @param {number|string} unixSeconds поле `date` из Telegram (секунды с эпохи)
 * @returns {boolean} true — сообщение можно рассматривать для автоответа.
 *   Без валидной даты отвечаем «нет»: непонятно свежее ли сообщение, а лишний
 *   ответ в чате заметнее, чем пропущенный.
 */
export const isFreshChatMessage = (
  unixSeconds,
  { now = Date.now(), windowMs = CHAT_MESSAGE_FRESH_MS } = {}
) => {
  const timestamp = Number(unixSeconds);

  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;

  return now - timestamp * 1000 <= windowMs;
};

/**
 * Первый подошедший ответ. Порядок — по id условия (кто раньше заведён, тот и
 * главнее), поэтому админ видит предсказуемый результат: бот пишет ровно один
 * ответ на сообщение, а не сколько-то.
 *
 * Текст нормализуется один раз на весь список условий: раньше это делалось
 * внутри `triggerMatches`, то есть N раз на N условий при одном и том же
 * сообщении.
 */
export const matchAutoReply = (replies, text) => {
  const normalizedText = normalizeTriggerText(text);

  if (!normalizedText) return null;

  for (const reply of replies ?? []) {
    const normalizedPhrase = normalizeTriggerText(reply.phrase);

    if (!normalizedPhrase) continue;
    if (!mayContainPhrase(normalizedPhrase, normalizedText)) continue;

    if (phrasePattern(normalizedPhrase).test(normalizedText)) return reply;
  }

  return null;
};

/** Валидация условия из админки: нормализованная пара «фраза → ответ». */
export const validateAutoReplyInput = ({ phrase, response }) => {
  const normalizedPhrase = normalizeTriggerText(phrase);
  const trimmedResponse = String(response ?? "").trim();

  if (!normalizedPhrase) {
    throw new Error("Пустая фраза: условие не сможет ничего поймать");
  }

  if (normalizedPhrase.length > CHAT_TRIGGER_PHRASE_LIMIT) {
    throw new Error(`Фраза длиннее ${CHAT_TRIGGER_PHRASE_LIMIT} символов`);
  }

  if (!trimmedResponse) {
    throw new Error("Пустой ответ: боту нечего отправлять");
  }

  if (trimmedResponse.length > CHAT_TRIGGER_RESPONSE_LIMIT) {
    throw new Error(`Ответ длиннее ${CHAT_TRIGGER_RESPONSE_LIMIT} символов`);
  }

  return { phrase: normalizedPhrase, response: trimmedResponse };
};

export default {
  CHAT_BOT_PLATFORM,
  CHAT_MESSAGE_FRESH_MS,
  normalizeTriggerText,
  triggerMatches,
  isFreshChatMessage,
  matchAutoReply,
  validateAutoReplyInput,
};
