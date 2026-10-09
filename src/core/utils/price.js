/**
 * Число из строки цены.
 *
 * `ads.price` — строка: в ней лежит и «1200», и «1 200 ₽», и «Договорная».
 * Для сортировки и фильтрации рядом с ней живёт `ads.price_value` — сюда же
 * правило переноса смотрит бэкенд, сюда же оно переписано в SQL миграции
 * (`prisma/migrations/add_ad_price_value.sql`): берётся первый числовой токен,
 * всё остальное становится NULL.
 */

export const parsePriceNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;

  // Запятая — десятичный разделитель (правило `normalizeAdPrice` на фронте),
  // меняем только первую: «1,5,3» числом быть не может.
  const digits = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  if (!digits) return null;

  // Тот же смысл, что у `substring(... from '^[0-9]+(\.[0-9]+)?')` в SQL:
  // «1.500» — это 1.5, а не 1500; разделитель тысяч в этой колонке не стоит.
  const parsed = parseFloat(digits);

  return Number.isFinite(parsed) ? parsed : null;
};

/** Decimal для Prisma: число строкой, иначе дробная часть уедет в округление. */
export const priceToDecimal = (value) => {
  const parsed = parsePriceNumber(value);

  return parsed === null ? null : String(parsed);
};
