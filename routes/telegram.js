// telegram.js
// This file re-creates the TelegramCreationService and exports it for use in routes.
// It uses the bot instance from services/telegramBot.js and provides a sendMessage function compatible with previous usage.

import bot from '../services/telegramBot.js';

import express from 'express';
const router = express.Router();
export default router;

export const TelegramCreationService = {
  /**
   * Send message or media to Telegram chats
   * @param {Object} options
   * @param {string} options.message - text message
   * @param {string[]} options.chatIds - array of chat IDs
   * @param {string[]} [options.threadIds] - array of thread IDs (optional)
   * @param {Array} [options.photos] - array of photo file objects (optional)
   * @returns {Promise<{results: Array}>}
   */
  async sendMessage({ message, chatIds, threadIds = [], photos = [] }) {
    const results = [];
    for (let i = 0; i < chatIds.length; ++i) {
      const chatId = chatIds[i];
      const threadId = threadIds[i] || undefined;
      try {
        let result;
        if (photos && photos.length > 0) {
          // Send as media group if multiple, or single photo if one
          if (photos.length > 1) {
            const media = photos.map(photo => ({ type: 'photo', media: photo }));
            result = await bot.sendMediaGroup(chatId, media, { message_thread_id: threadId });
          } else {
            result = await bot.sendPhoto(chatId, photos[0], { caption: message, parse_mode: 'HTML', message_thread_id: threadId });
          }
        } else {
          result = await bot.sendMessage(chatId, message, { parse_mode: 'HTML', message_thread_id: threadId });
        }
        results.push({ chatId, threadId, result });
      } catch (err) {
        results.push({ chatId, threadId, error: err.message });
      }
    }
    return { results };
  }
};
