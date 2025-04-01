import { supabase } from '../db.js';
import bot from '../bot.js';

const escapeHTML = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
};

function generateAnnouncementUrl(announcementId) {
  return `https://tp.sibroot.ru/#/announcement/${announcementId}`;
}

const separator = '🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹';

export const generateAnnouncementText = async (announcement) => {
  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('user_id', announcement.user_id)
    .single();

  const authorText = userData?.username
    ? `👤 <b>Автор объявления</b>: @${userData.username}`
    : `👤 <b>Автор объявления</b>: <a href="tg://user?id=${announcement.user_id}">ID</a>`;

  const title = escapeHTML(announcement.title || 'Без названия');
  const content = escapeHTML(announcement.content || 'Описание отсутствует');
  const price = announcement.price ? `💰 <b>Цена</b>: ${escapeHTML(announcement.price.toString())} ₽` : '';

  return `
📢 <b>Объявление было изменено</b> 📢 
${title}
${separator}

${content}

${price}

${authorText}
🔗 <b>Посмотреть это объявление на сайте</b>: <a href="${generateAnnouncementUrl(announcement.id)}">Здесь</a>`
    .trim();
};

export const updateAnnouncementInTelegram = async (data) => {
  const announcement = data.announcement || data.announcementData || data;
  const announcementId = announcement.id || data.announcementId || data.id;

  if (!announcement || !announcementId) {
    console.error('Некорректные данные объявления:', { data, announcement, announcementId });
    return { success: false, message: 'Некорректные данные объявления' };
  }

  try {
    const { data: telegramMessages, error: fetchError } = await supabase
      .from('telegram_messages')
      .select('*')
      .eq('ad_id', announcementId);

    if (fetchError) {
      console.error('Ошибка при получении сообщений из БД:', fetchError);
      return { success: false, message: fetchError.message };
    }

    if (!telegramMessages || telegramMessages.length === 0) {
      console.warn(`Нет сообщений в Telegram для объявления ID: ${announcementId}`);
      return { success: false, message: 'Нет сообщений в Telegram' };
    }

    const messageText = await generateAnnouncementText(announcement);
    const imageUrls = announcement.images || 
                     announcement.ad_images?.map(img => img.image_url) || 
                     data.imageUrls || 
                     [];

    const updatePromises = telegramMessages.map(async (message) => {
      try {
        if (message.media_group_id) {
          // Обновляем caption для медиа-группы
          await bot.telegram.editMessageCaption(
            message.chat_id,
            message.message_id,
            undefined,
            messageText,
            { parse_mode: 'HTML' }
          );
        } else {
          // Обновляем текст обычного сообщения
          await bot.telegram.editMessageText(
            message.chat_id,
            message.message_id,
            undefined,
            messageText,
            { parse_mode: 'HTML' }
          );
        }
        return true;
      } catch (error) {
        console.error(`Ошибка обновления сообщения ${message.message_id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(updatePromises);
    const allUpdated = results.every(result => result);

    return { 
      success: allUpdated,
      message: allUpdated ? 'Все сообщения обновлены' : 'Не все сообщения были обновлены'
    };

  } catch (error) {
    console.error('Ошибка при обновлении объявления:', error);
    return { success: false, message: error.message };
  }
}; 