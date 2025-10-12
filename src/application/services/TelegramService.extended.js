/**
 * Extended methods for TelegramService
 * Add these methods to the existing TelegramService.js
 */

/**
 * Notify seller about new booking
 * @param {number} sellerId - User ID of the seller
 * @param {Object} booking - Booking object
 * @param {number} queuePosition - Position in queue
 */
async notifySellerAboutBooking(sellerId, booking, queuePosition) {
  try {
    // Get seller's telegram ID
    const seller = await this._getUserById(sellerId);
    if (!seller || !seller.id_telegram) {
      logger.warn('Seller has no Telegram ID', { sellerId });
      return;
    }

    const message = this._buildBookingNotificationMessage(booking, queuePosition);

    await bot.sendMessage(seller.id_telegram, message, {
      parse_mode: 'HTML',
    });

    logger.info('Seller notified about booking', {
      sellerId,
      bookingId: booking.id,
    });
  } catch (error) {
    logger.error('Failed to notify seller about booking', {
      sellerId,
      bookingId: booking.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Notify buyer about booking status change
 * @param {number} buyerId - User ID of the buyer
 * @param {Object} booking - Booking object
 * @param {string} status - New status
 */
async notifyBuyerAboutStatus(buyerId, booking, status) {
  try {
    // Get buyer's telegram ID
    const buyer = await this._getUserById(buyerId);
    if (!buyer || !buyer.id_telegram) {
      logger.warn('Buyer has no Telegram ID', { buyerId });
      return;
    }

    const message = this._buildBookingStatusMessage(booking, status);

    await bot.sendMessage(buyer.id_telegram, message, {
      parse_mode: 'HTML',
    });

    logger.info('Buyer notified about booking status', {
      buyerId,
      bookingId: booking.id,
      status,
    });
  } catch (error) {
    logger.error('Failed to notify buyer about booking status', {
      buyerId,
      bookingId: booking.id,
      status,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Update ad in Telegram (add status label)
 * @param {number} adId - Ad ID
 * @param {Array} messageIds - Array of {chatId, messageId}
 * @param {string} status - New status (archived, sold)
 */
async updateAdInTelegram(adId, messageIds, status) {
  try {
    const statusLabel = status === 'sold' ? '[ПРОДАНО]' : '[АРХИВ]';
    
    for (const { chatId, messageId } of messageIds) {
      await this.limit(async () => {
        try {
          // Get current message
          const message = await bot.getMessage(chatId, messageId);
          
          // Add status label to caption or text
          let newText = message.caption || message.text || '';
          if (!newText.includes(statusLabel)) {
            newText = `${statusLabel}\n\n${newText}`;
          }

          // Edit message
          if (message.caption) {
            await bot.editMessageCaption(newText, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'HTML',
            });
          } else {
            await bot.editMessageText(newText, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'HTML',
            });
          }

          await this._delay();
        } catch (error) {
          logger.error('Failed to update message in Telegram', {
            chatId,
            messageId,
            error: error.message,
          });
        }
      });
    }

    logger.info('Ad updated in Telegram', { adId, status });
  } catch (error) {
    logger.error('Failed to update ad in Telegram', {
      adId,
      status,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Notify owner about ad archival
 * @param {number} ownerId - User ID of the ad owner
 * @param {Object} ad - Ad object
 * @param {Object} stats - Ad statistics
 */
async notifyOwnerAboutArchival(ownerId, ad, stats) {
  try {
    const owner = await this._getUserById(ownerId);
    if (!owner || !owner.id_telegram) {
      logger.warn('Owner has no Telegram ID', { ownerId });
      return;
    }

    const message = this._buildArchivalNotificationMessage(ad, stats);

    await bot.sendMessage(owner.id_telegram, message, {
      parse_mode: 'HTML',
    });

    logger.info('Owner notified about archival', { ownerId, adId: ad.id });
  } catch (error) {
    logger.error('Failed to notify owner about archival', {
      ownerId,
      adId: ad.id,
      error: error.message,
    });
  }
}

/**
 * Build booking notification message for seller
 * @private
 */
_buildBookingNotificationMessage(booking, queuePosition) {
  const buyer = booking.user;
  const ad = booking.ad;

  return `
🔔 <b>Новое бронирование!</b>

📢 <b>Объявление:</b> ${ad.title}
👤 <b>Покупатель:</b> ${buyer.first_name} ${buyer.last_name || ''}${buyer.username ? ` (@${buyer.username})` : ''}
💬 <b>Сообщение:</b> ${booking.message || 'Не указано'}

📊 <b>Позиция в очереди:</b> ${queuePosition}

Управляйте бронированиями в личном кабинете на сайте.
  `.trim();
}

/**
 * Build booking status message for buyer
 * @private
 */
_buildBookingStatusMessage(booking, status) {
  const statusEmoji = status === 'confirmed' ? '✅' : '❌';
  const statusText = status === 'confirmed' ? 'подтверждено' : 'отклонено';
  const ad = booking.ad;
  const seller = ad.user;

  let message = `
${statusEmoji} <b>Ваше бронирование ${statusText}!</b>

📢 <b>Объявление:</b> ${ad.title}
💰 <b>Цена:</b> ${ad.price ? `${ad.price} ₽` : 'Договорная'}
👤 <b>Продавец:</b> ${seller.first_name} ${seller.last_name || ''}${seller.username ? ` (@${seller.username})` : ''}
  `.trim();

  if (status === 'confirmed' && booking.seller_note) {
    message += `\n\n📝 <b>Примечание продавца:</b>\n${booking.seller_note}`;
  }

  return message;
}

/**
 * Build archival notification message
 * @private
 */
_buildArchivalNotificationMessage(ad, stats) {
  return `
⚠️ <b>Объявление отправлено в архив</b>

📢 <b>Название:</b> ${ad.title}
📅 <b>Опубликовано:</b> ${new Date(ad.created_at).toLocaleDateString('ru-RU')}
👀 <b>Просмотров:</b> ${stats.view_count || 0}
💬 <b>Комментариев:</b> ${stats.comments_count || 0}
🔖 <b>Бронирований:</b> ${stats.bookings_count || 0}

Срок публикации истёк. Вы можете продлить объявление на сайте.
  `.trim();
}

/**
 * Get user by ID (helper method)
 * @private
 */
async _getUserById(userId) {
  // This should use UserRepository from DI
  // For now, using prisma directly
  const { prisma } = require('../../infrastructure/database/prisma');
  return await prisma.user.findUnique({
    where: { id: userId },
  });
}

