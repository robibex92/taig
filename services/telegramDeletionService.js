import { supabase } from '../db.js';
import bot from '../bot.js';

export const deleteAnnouncementFromTelegram = async (announcement) => {
  try {
    // Находим все сообщения, связанные с этим объявлением в базе данных
    const { data: telegramMessages, error: fetchError } = await supabase
      .from('telegram_messages')
      .select('*')
      .eq('ad_id', announcement.id);

    if (fetchError) {
      console.error('Ошибка при поиске сообщений для удаления:', fetchError);
      return;
    }

    if (!telegramMessages || telegramMessages.length === 0) {
      console.warn('Нет сообщений для удаления');
      return;
    }

    // Группируем сообщения по chat_id и media_group_id
    const messagesByGroup = telegramMessages.reduce((acc, message) => {
      const key = `${message.chat_id}_${message.media_group_id || message.message_id}`;
      if (!acc[key]) {
        acc[key] = {
          chat_id: message.chat_id,
          message_ids: [],
          media_group_id: message.media_group_id
        };
      }
      acc[key].message_ids.push(message.message_id);
      return acc;
    }, {});

    // Удаляем каждую группу сообщений
    const deletePromises = Object.values(messagesByGroup).map(async (group) => {
      return deleteMessage({
        chatId: group.chat_id,
        messageId: group.message_ids[0],
        mediaGroupId: group.media_group_id
      });
    });

    const deletionResults = await Promise.all(deletePromises);
    const allDeleted = deletionResults.every(result => result.success);

    if (allDeleted) {
      await supabase
        .from('telegram_messages')
        .delete()
        .eq('ad_id', announcement.id);
    }

    return { success: allDeleted };
  } catch (error) {
    console.error('Общая ошибка при удалении объявления:', error);
    return { success: false, error: error.message };
  }
};

export const deleteMessage = async ({ chatId, messageId, mediaGroupId }) => {
  try {
    if (mediaGroupId) {
      // Получаем все сообщения медиа-группы
      const { data: messages } = await supabase
        .from('telegram_messages')
        .select('message_id')
        .eq('media_group_id', mediaGroupId)
        .eq('chat_id', chatId);

      // Удаляем все сообщения медиа-группы
      for (const message of messages) {
        try {
          await bot.telegram.deleteMessage(chatId, message.message_id);
        } catch (error) {
          console.warn(`Не удалось удалить сообщение ${message.message_id}:`, error);
        }
      }

      // Удаляем записи из базы данных
      await supabase
        .from('telegram_messages')
        .delete()
        .eq('media_group_id', mediaGroupId)
        .eq('chat_id', chatId);
    } else {
      // Удаляем одиночное сообщение
      await bot.telegram.deleteMessage(chatId, messageId);

      // Удаляем запись из базы данных
      await supabase
        .from('telegram_messages')
        .delete()
        .eq('message_id', messageId)
        .eq('chat_id', chatId);
    }

    return { success: true };
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
    return { success: false, message: error.message };
  }
}; 