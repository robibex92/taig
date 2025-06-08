// Utility to map selected chat keys to chat ids and thread ids
import pkg from "../config/telegramChats.cjs";
const { TELEGRAM_CHATS } = pkg;

/**
 * Given an array of chat keys (e.g. ['MAIN_GROUP', 'ANNOUNCEMENTS']),
 * returns an array of objects: [{ chatId, threadId }]
 */
export function getTelegramChatTargets(chatKeys) {
  if (!Array.isArray(chatKeys)) return [];
  const uniqueTargets = new Map();
  chatKeys.forEach((key) => {
    const chat = TELEGRAM_CHATS[key];
    if (!chat) return;
    const keyStr = `${chat.id}_${chat.threadId || "null"}`;
    if (!uniqueTargets.has(keyStr)) {
      uniqueTargets.set(keyStr, {
        chatId: chat.id,
        threadId: chat.threadId || null,
        name: chat.name || key,
      });
    }
  });
  return Array.from(uniqueTargets.values());
}
