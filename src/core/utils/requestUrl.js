/**
 * Базовый адрес для внешних ссылок на загруженные файлы.
 *
 * `API_URL` — публичный адрес API (`https://…/api-v1`), а файлы лежат в `uploads/`
 * на том же хосте, поэтому суффикс срезается. Без env остаётся протокол+host
 * запроса — так работают локальные прогоны.
 *
 * Значение читается при вызове: `dotenv.config()` в server.js выполняется позже
 * статических импортов (см. H1.5 в реестре рефакторинга).
 */
export const buildServerUrl = (req) =>
  process.env.API_URL
    ? process.env.API_URL.replace("/api-v1", "")
    : `${req.protocol}://${req.get("host")}`;

/**
 * Абсолютная ссылка на эндпоинт API для исходящих сообщений ботов
 * (подтверждение входа MAX, AR-1). Без `API_URL` ссылки не собрать —
 * вызывающий обязан обработать null.
 */
export const apiPublicLink = (path) =>
  process.env.API_URL ? `${process.env.API_URL.replace(/\/+$/, "")}${path}` : null;
