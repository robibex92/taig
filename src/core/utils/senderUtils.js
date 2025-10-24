/**
 * Утилиты для форматирования информации об отправителе
 */

/**
 * Форматирует имя отправителя для Telegram уведомлений
 * @param {Object} sender - Объект с данными отправителя
 * @param {string} sender.username - Username пользователя
 * @param {string} sender.first_name - Имя пользователя
 * @param {string} sender.telegram_first_name - Telegram имя
 * @param {string} sender.last_name - Фамилия пользователя
 * @param {string} sender.telegram_last_name - Telegram фамилия
 * @returns {string} Отформатированное имя отправителя
 */
export function formatSenderName(sender) {
  if (!sender) return "Пользователь";

  // Приоритет: username (с @), затем telegram_first_name, затем first_name
  if (sender.username) {
    return `@${sender.username}`;
  }

  if (sender.telegram_first_name) {
    return sender.telegram_first_name;
  }

  if (sender.first_name) {
    return sender.first_name;
  }

  return "Пользователь";
}

/**
 * Форматирует полное имя отправителя (имя + фамилия)
 * @param {Object} sender - Объект с данными отправителя
 * @returns {string} Полное имя отправителя
 */
export function formatFullSenderName(sender) {
  if (!sender) return "Пользователь";

  const firstName = sender.telegram_first_name || sender.first_name;
  const lastName = sender.telegram_last_name || sender.last_name;

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  if (firstName) {
    return firstName;
  }

  if (sender.username) {
    return `@${sender.username}`;
  }

  return "Пользователь";
}
