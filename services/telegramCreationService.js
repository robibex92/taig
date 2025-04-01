import bot from '../bot.js';
import { supabase } from '../db.js';

function escapeHTML(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

const separator = '🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹';

function generateAnnouncementUrl(announcementId) {
  return `https://tp.sibroot.ru/#/announcement/${announcementId}`;
}

function getSafeImageUrl(imageUrl) {
  return imageUrl || 'https://tp.sibroot.ru/uploads/default-image.png';
}

export class TelegramCreationService {
  static async sendMessage({
    message,
    chatIds,
    threadIds = [],
    photos = [],
    adId,
    userId
  }) {
    try {
      const sendPromises = chatIds.map(async (chatId, index) => {
        const threadId = threadIds[index];

        if (photos.length > 0) {
          const mediaGroup = photos.map((imageUrl, index) => ({
            type: 'photo',
            media: getSafeImageUrl(imageUrl),
            ...(index === 0 ? { caption: message, parse_mode: "HTML" } : {})
          }));

          try {
            const result = await bot.telegram.sendMediaGroup(chatId, mediaGroup, {
              ...(threadId ? { message_thread_id: threadId } : {})
            });

            if (!result || !Array.isArray(result)) {
              console.error('Не удалось отправить медиа-группу');
              return;
            }

            const mediaGroupId = result[0].media_group_id;
            const messageId = result[0].message_id;

            await supabase
              .from('telegram_messages')
              .insert({
                ad_id: adId,
                chat_id: chatId,
                message_id: messageId,
                thread_id: threadId,
                media_group_id: mediaGroupId,
                message_type: 'initial'
              });
          } catch (error) {
            console.error('Ошибка при отправке медиа-группы:', error);
          }
        } else {
          try {
            const result = await bot.telegram.sendMessage(chatId, message, {
              parse_mode: "HTML",
              ...(threadId ? { message_thread_id: threadId } : {})
            });

            if (!result) {
              console.error('Не удалось отправить сообщение');
              return;
            }

            await supabase
              .from('telegram_messages')
              .insert({
                ad_id: adId,
                chat_id: chatId,
                message_id: result.message_id,
                thread_id: threadId,
                message_type: 'initial'
              });
          } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
          }
        }
      });

      await Promise.all(sendPromises);
      return { success: true };
    } catch (error) {
      console.error('Ошибка при отправке объявления в Telegram:', error);
      return { success: false, message: error.message };
    }
  }

  static async generateAnnouncementText(data) {
    const { title, content, price, username, user_id: userId } = data;

    const authorText = username
      ? `👤 <b>Автор объявления</b>: @${username}`
      : `👤 <b>Автор объявления</b>: <a href="tg://user?id=${userId}">ID</a>`;

    return `
📢 <b>Новое объявление</b> 📢
${escapeHTML(title)}
${separator}
${escapeHTML(content)}
${price ? `\n💰 <b>Цена</b>: ${escapeHTML(price.toString())} ₽` : ''}
${authorText}
🔗 <b>Посмотреть это объявление на сайте</b>: <a href="${generateAnnouncementUrl(data.id)}">Здесь</a>`.trim();
  }
} 