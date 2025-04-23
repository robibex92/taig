// Utility to map selected chat keys to chat ids and thread ids
import pkg from '../config/telegramChats.cjs';
const { TELEGRAM_CHATS } = pkg;

/**
 * Given an array of chat keys (e.g. ['MAIN_GROUP', 'ANNOUNCEMENTS']),
 * returns an array of objects: [{ chatId, threadId }]
 */
export function getTelegramChatTargets(chatKeys) {
  if (!Array.isArray(chatKeys)) return [];
  return chatKeys.map(key => {
    const chat = TELEGRAM_CHATS[key];
    if (!chat) return null;
    return {
      chatId: chat.id,
      threadId: chat.threadId || null,
      name: chat.name || key
    };
  }).filter(Boolean);
}
