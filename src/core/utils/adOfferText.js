import { AD_OFFER_TYPE } from "../constants/index.js";

/**
 * Русское склонение счётника дней: 1 день, 2 дня, 5 дней, 11 дней.
 *
 * Склонение руками, а не библиотекой: слов в языке для этого правила четыре,
 * а зависимость с данными локалей стоила бы больше, чем вся страница объявлений.
 */
const pluralDays = (days) => {
  const teens = days % 100 >= 11 && days % 100 <= 14;
  const last = days % 10;

  if (!teens && last === 1) return "день";
  if (!teens && last >= 2 && last <= 4) return "дня";
  return "дней";
};

/**
 * Строка предложения для текста, который уходит в чат дома.
 *
 * Продажа ничего не добавляет, прокат — срок. Без этой строки сосед читает
 * «💰 Цена: 500» над дрелью, которую отдают на три дня, и предлагает купить:
 * объявление в чате теряет ровно то, ради чего оно там появилось.
 */
export const adOfferLine = (ad) => {
  if (ad?.offer_type !== AD_OFFER_TYPE.RENT) return null;

  const days = Number(ad.rental_days);

  return Number.isInteger(days) && days > 0
    ? `🔄 Напрокат: на ${days} ${pluralDays(days)}`
    : "🔄 Напрокат";
};
