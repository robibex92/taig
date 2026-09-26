import { logger } from "../../../core/utils/logger.js";

/**
 * Публикация объявления в Telegram-чаты — одна на все сценарии.
 *
 * Раньше тот же цикл публикации был написан пять раз: два почти дословных
 * блока удаления (archive и deleted) и три цикла публикации (text-only,
 * с медиа и repost в ветке «сообщения слишком старые»). Различались они только
 * текстом лога, а в двух из них `catch` обращался к переменной, объявленной
 * внутри `try`, — то есть обработка сбоя публикации сама падала с
 * ReferenceError, и причину потери внешняя обёртка не видела.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Пауза между операциями: Telegram считает запросы к одному боту, а не к одному чату. */
export const PUBLISH_DELAY_MS = 300;
export const MESSAGE_OPERATION_DELAY_MS = 100;

export { sleep };

const threadOf = (threadId) => (threadId ? String(threadId) : undefined);

/** Одна строка = один чат и одна тема внутри него. */
export const groupKey = (chatId, threadId) => `${chatId}_${threadId || "no_thread"}`;

/**
 * Куда repost'ить. Выбранные пользователем чаты важнее старых сообщений:
 * иначе «обновить и переопубликовать» всегда вернётся в прежний набор.
 */
export function chatGroupsFor({ selectedChats = [], messages = [] }) {
  const groups = new Map();

  if (selectedChats.length > 0) {
    for (const chatId of selectedChats) {
      groups.set(groupKey(chatId, null), { chat_record_id: chatId, thread_id: null });
    }
    return groups;
  }

  for (const message of messages) {
    const key = groupKey(message.chat_id, message.thread_id);
    if (!groups.has(key)) {
      groups.set(key, {
        chat_record_id: message.chat_id,
        thread_id: message.thread_id ?? null,
      });
    }
  }

  return groups;
}

/**
 * Внутренние id записей `telegram_chats` → настоящие `chat_id`/`thread_id`.
 * Публиковать по внутреннему id нельзя: это не идентификатор чата в Telegram.
 */
export async function resolveChatTargets({ groups, telegramChatRepository, adId }) {
  const targets = [];

  for (const group of groups.values()) {
    const chat = await telegramChatRepository.getById(group.chat_record_id);

    if (!chat) {
      logger.error("Telegram chat record not found, skipping publication", {
        ad_id: adId,
        chat_record_id: group.chat_record_id,
      });
      continue;
    }

    targets.push({ chat_id: chat.chat_id, thread_id: chat.thread_id ?? null });
  }

  return targets;
}

/**
 * @param {Array<{chat_id: string|number, thread_id?: string|number|null}>} chats
 *   настоящие id чатов; `publishAd` сам решает, текст или альбом.
 * @returns {Promise<number>} сколько чатов приняли публикацию
 */
export async function publishToChats({ ad, chats, telegramService }) {
  let published = 0;

  for (const chat of chats) {
    try {
      await telegramService.publishAd(ad, String(chat.chat_id), threadOf(chat.thread_id));
      published += 1;
      logger.info("Ad published to Telegram chat", {
        ad_id: ad.id,
        chat_id: String(chat.chat_id),
        thread_id: chat.thread_id ? String(chat.thread_id) : null,
      });
    } catch (err) {
      logger.error("Failed to publish ad in Telegram chat", {
        ad_id: ad.id,
        chat_id: String(chat.chat_id),
        thread_id: chat.thread_id ? String(chat.thread_id) : null,
        error: err.message,
        stack: err.stack,
      });
    }

    await sleep(PUBLISH_DELAY_MS);
  }

  return published;
}

/** Объявление уходит в архив или удалено: сообщения убираются из чатов и из журнала. */
export async function removeAdFromChats({
  messages,
  telegramService,
  adRepository,
  adId,
  reason,
}) {
  logger.info(`Deleting ${messages.length} Telegram messages for ${reason} ad`, {
    ad_id: adId,
  });

  const results = await Promise.allSettled(
    messages.map((message) =>
      telegramService.deleteMessage({
        chatId: message.chat_id,
        messageId: message.message_id,
        threadId: message.thread_id || undefined,
      })
    )
  );

  const deleted = results.filter(
    (result) => result.status === "fulfilled" && result.value?.success
  ).length;

  logger.info(`Deleted ${deleted}/${messages.length} Telegram messages`, {
    ad_id: adId,
    reason,
  });

  await adRepository.deleteTelegramMessagesByAdId(adId);

  return { deleted, total: messages.length };
}

/** Перед repost'ом старые сообщения снимаются последовательно, с паузами. */
export async function clearChatsForRepost({
  messages,
  telegramService,
  adRepository,
  adId,
}) {
  for (const message of messages) {
    try {
      await telegramService.deleteMessage({
        chatId: String(message.chat_id),
        messageId: String(message.message_id),
        threadId: threadOf(message.thread_id),
      });
    } catch (err) {
      logger.error("Failed to delete Telegram message before repost", {
        ad_id: adId,
        chat_id: String(message.chat_id),
        message_id: String(message.message_id),
        error: err.message,
      });
    }

    await sleep(MESSAGE_OPERATION_DELAY_MS);
  }

  await adRepository.deleteTelegramMessagesByAdId(adId);
}
