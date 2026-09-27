/**
 * Application-wide constants
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

export const AD_STATUS = {
  ACTIVE: "active",
  ARCHIVE: "archive",
  DRAFT: "draft",
  DELETED: "deleted",
};

/** Срок, после которого объявление считается устаревшим, если не задан env. */
export const AD_LIFETIME_DEFAULT_DAYS = 30;

/**
 * Срок устаревания объявления в днях (`AD_LIFETIME_DAYS`).
 *
 * Отсчёт идёт от последней правки (`ads.updated_at`), а у объявления без правок —
 * от `created_at`. «Отметить актуальность» на фронте просто сдвигает этот якорь.
 */
export const adLifetimeDays = () => {
  const configured = Number(process.env.AD_LIFETIME_DAYS);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : AD_LIFETIME_DEFAULT_DAYS;
};

/** Момент, когда объявление устареет, если его «актуальность» отсчитывается от `from`. */
export const adExpiresAt = (from = new Date(), days = adLifetimeDays()) =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

export const TOKEN_TYPES = {
  ACCESS: "access",
  REFRESH: "refresh",
};

/** Максимум ячеек, который может занять квартира в сетке «Сосед, привет». */
export const HOUSE_CELL_SPAN_MAX = 6;

/** Потолок номера колонки в ряду — страховка от мусора в запросе, не смысл витрины. */
export const HOUSE_CELL_INDEX_MAX = 60;

/** Потолок этажа при правке раскладки — страховка от мусора в запросе. */
export const HOUSE_FLOOR_MAX = 99;

/** Длина текста информации о квартире в реестре. */
export const HOUSE_INFO_MAX_LENGTH = 5000;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const SORT_ORDER = {
  ASC: "ASC",
  DESC: "DESC",
};

export const AD_SORT_FIELDS = {
  CREATED_AT: "created_at",
  UPDATED_AT: "updated_at",
  PRICE: "price",
  TITLE: "title",
};

// API versioning - prefix /api-v1 is applied in server.js via app.use()
export const API_PREFIX = "";
export const API_VERSION = "";

// CommonJS compatibility for legacy code
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HTTP_STATUS,
    ERROR_CODES,
    AD_STATUS,
    TOKEN_TYPES,
    PAGINATION,
    SORT_ORDER,
    AD_SORT_FIELDS,
    API_PREFIX,
    API_VERSION,
  };
}
