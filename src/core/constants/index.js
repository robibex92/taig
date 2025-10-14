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

export const USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BANNED: "banned",
  BLOCKING: "blocking",
};

export const USER_ROLES = {
  USER: "user",
  MODERATOR: "moderator",
  ADMIN: "admin",
};

export const TOKEN_TYPES = {
  ACCESS: "access",
  REFRESH: "refresh",
};

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
    USER_STATUS,
    USER_ROLES,
    TOKEN_TYPES,
    PAGINATION,
    SORT_ORDER,
    AD_SORT_FIELDS,
    API_PREFIX,
    API_VERSION,
  };
}
