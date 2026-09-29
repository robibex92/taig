import { logger } from "../../../core/utils/logger.js";
import { frontendLink } from "../../services/TelegramService.js";
import { PUBLISH_DELAY_MS, sleep } from "./adPublishing.js";

/**
 * Публикация объявления в MAX-чаты.
 *
 * Отдельный модуль рядом с `adPublishing.js`, а не ветка внутри него: у
 * Telegram цель публикации — пара `chat_id` + `thread_id` и альбом картинок,
 * у MAX — просто чат и один текст, а журнал сообщений lives в другой таблице.
 * Общая часть здесь только одна — пауза между запросами и подход к ошибкам:
 * сбой MAX не отменяет объявление и не мешает остальным чатам.
 */

/**
 * Текст сообщения.
 *
 * HTML-разметку Telegram сюда не переносим: `format` у MAX API есть, но
 * допустимые значения на живом боте не проверяли, поэтому текст ровный, а
 * ссылки — обычные. Картинки тоже не переносим: для них нужен отдельный
 * `POST /uploads` и вложение в теле запроса.
 */
export const buildMaxAdMessageText = (ad) => {
  const lines = [`📢 ${ad.title ?? "Объявление"}`, "", (ad.content ?? "").trim()];

  if (ad.price) {
    lines.push("", `💰 Цена: ${ad.price}`);
  }

  const author = ad.user?.username ? `@${ad.user.username}` : null;

  if (author) {
    lines.push("", `👤 Автор: ${author}`);
  }

  lines.push("", `🔗 Просмотреть: ${frontendLink(`/ads/${ad.id}`)}`);

  return lines.filter((line) => line !== undefined).join("\n");
};

/**
 * @param {Array<{chat_id: string|number}>} chats настоящие id чатов MAX
 * @returns {Promise<number>} сколько чатов приняли публикацию
 */
export async function publishToMaxChats({ ad, chats, maxService, adRepository }) {
  const text = buildMaxAdMessageText(ad);
  let published = 0;

  for (const chat of chats) {
    const chatId = String(chat.chat_id);

    try {
      const result = await maxService.sendChatMessage(chatId, text);

      if (!result.ok) {
        logger.error("Failed to publish ad in MAX chat", {
          ad_id: ad.id,
          chat_id: chatId,
          error: result.error,
          code: result.code,
        });
        await sleep(PUBLISH_DELAY_MS);
        continue;
      }

      published += 1;

      // Без id удаление при repost'е невозможно: журнал заводим только тем
      // чатам, где MAX назвал сообщение.
      if (result.message_id) {
        await adRepository.createMaxMessage({
          ad_id: ad.id,
          chat_id: chatId,
          message_id: result.message_id,
        });
      } else {
        logger.warn("MAX published without message id, journal skipped", {
          ad_id: ad.id,
          chat_id: chatId,
        });
      }

      logger.info("Ad published to MAX chat", { ad_id: ad.id, chat_id: chatId });
    } catch (err) {
      logger.error("Error publishing ad to MAX chat", {
        ad_id: ad.id,
        chat_id: chatId,
        error: err.message,
      });
    }

    await sleep(PUBLISH_DELAY_MS);
  }

  return published;
}

/**
 * Объявление архивируется, удаляется или уходит в repost: снимаем его посты из
 * MAX и чистим журнал. Как и в Telegram-ветке, одна неудача не останавливает
 * остальные и не отменяет операцию над объявлением.
 */
export async function removeAdFromMaxChats({
  messages,
  maxService,
  adRepository,
  adId,
  reason,
}) {
  let deleted = 0;

  for (const message of messages) {
    try {
      const result = await maxService.deleteMessage(message.message_id);

      if (result?.ok) {
        deleted += 1;
      } else {
        logger.warn("MAX message not deleted", {
          ad_id: adId,
          chat_id: String(message.chat_id),
          message_id: String(message.message_id),
          error: result?.error,
          code: result?.code,
        });
      }
    } catch (err) {
      logger.error("Error deleting MAX message", {
        ad_id: adId,
        chat_id: String(message.chat_id),
        message_id: String(message.message_id),
        error: err.message,
      });
    }

    await sleep(PUBLISH_DELAY_MS);
  }

  await adRepository.deleteMaxMessagesByAdId(adId);

  logger.info(`Removed ${deleted}/${messages.length} MAX messages`, {
    ad_id: adId,
    reason,
  });

  return { deleted, total: messages.length };
}
