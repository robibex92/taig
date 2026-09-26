import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { logger } from "../../core/utils/logger.js";
import { TokenService } from "../../application/services/TokenService.improved.js";

/**
 * Helmet security middleware configuration
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"], // Добавлено http: для локальной разработки
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Разрешаем кросс-доменную загрузку ресурсов
});

/**
 * Rate limiting
 *
 * Ключ квоты — пользователь, а не только IP: жители комплекса выходят в интернет
 * через один NAT, и при чисто IP-ном учёте сосед, листающий объявления, исчерпывал
 * бы квоту на весь дом. Для гостя (нет валидного access-токена) остаётся IP.
 */
let cachedTokenService;

const resolveTokenService = () => {
  if (cachedTokenService === undefined) {
    try {
      cachedTokenService = new TokenService();
    } catch (error) {
      // Секреты не заданы (тесты, локальный запуск) — считаем квоту по IP.
      logger.warn("Rate limiter falls back to IP keys", { error: error.message });
      cachedTokenService = null;
    }
  }

  return cachedTokenService;
};

export const rateLimitKey = (req) => {
  // Лимитеры, смонтированные после `authenticateJWT`, уже знают пользователя.
  if (req.user?.user_id) return `user:${req.user.user_id}`;

  const header = req.headers.authorization;
  const tokenService = header?.startsWith("Bearer ") ? resolveTokenService() : null;

  if (tokenService) {
    try {
      const decoded = tokenService.verifyAccessToken(header.slice(7), {
        userAgent: req.headers["user-agent"] || "",
        ip: req.ip || "",
      });

      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Просрочен/отозван/не с того устройства — гость на этом запросе.
    }
  }

  return req.ip;
};

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const rateLimitMessage = (code) => ({
  error: {
    message: "Слишком много запросов, попробуйте позже",
    code,
  },
});

const skipRefresh = (req) => req.path === "/api/auth/refresh";

const limiterOptions = (max, code) => ({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max,
  message: rateLimitMessage(code),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  validate: { trustProxy: false },
  skip: skipRefresh,
});

/** Чтение: дешёвое и массовое (списки объявлений тянут картинки и авторов). */
export const readLimiter = rateLimit(
  limiterOptions(parseInt(process.env.RATE_LIMIT_READ_MAX) || 3000, "READ_RATE_LIMIT_EXCEEDED")
);

/** Запись: сюда же попадают upload-ы, поэтому лимит заметно мягче «10 запросов в час». */
export const writeLimiter = rateLimit(
  limiterOptions(
    parseInt(process.env.RATE_LIMIT_WRITE_MAX) ||
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) ||
      500,
    "WRITE_RATE_LIMIT_EXCEEDED"
  )
);

/**
 * Точка входа в `server.js`: один `app.use`, метод выбирает квоту.
 * Общим было бы считать и чтение, и запись одним числом — тогда просмотр
 * витрины объявлений съедал бюджет, оставленный для действий.
 */
export const generalLimiter = (req, res, next) =>
  (req.method === "GET" || req.method === "HEAD" ? readLimiter : writeLimiter)(req, res, next);

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40,
  skipSuccessfulRequests: true,
  message: {
    error: {
      message: "Too many authentication attempts, please try again later",
      code: "AUTH_RATE_LIMIT_EXCEEDED",
    },
  },
  validate: { trustProxy: false }, // Disable validation warning
});

/**
 * Rate limiter for ad creation
 *
 * Ключ — пользователь: эти лимитеры смонтированы после `authenticateJWT`, а на
 * общем IP всего дома «10 объявлений в час» выгорали бы от действий одного соседа.
 */
export const createAdLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_CREATE_ADS_MAX) || 10,
  keyGenerator: rateLimitKey,
  message: {
    error: {
      message: "Слишком много объявлений, попробуйте позже",
      code: "CREATE_AD_RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Disable validation warning
});

/**
 * Rate limiter for feedback messages
 */
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_FEEDBACK_MAX) || 3,
  keyGenerator: rateLimitKey,
  message: {
    error: {
      message: "Слишком много обращений, попробуйте позже",
      code: "FEEDBACK_RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Disable validation warning
  skip: (req) => {
    // Авторизованные жители идут под своей квотой, а не под общей на весь IP.
    return Boolean(req.user && req.user.user_id);
  },
});
