// `dotenv/config` первой строкой: раньше `dotenv.config()` вызывался в теле этого
// модуля, а тела модулей, которые он импортирует, выполняются раньше — все
// `process.env.*` на уровне импортов (токен Telegram-бота, MAX_BOT_TOKEN,
// FEEDBACK_CHAT_ID) получали `undefined`. На проде это маскировалось тем, что PM2
// отдаёт переменные до старта Node; локально бот поднимался без токена.
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import cron from "node-cron";
import swaggerUi from "swagger-ui-express";

// Core
import { logger } from "./core/utils/logger.js";
import {
  errorHandler,
  notFoundHandler,
} from "./core/middlewares/errorHandler.js";
import {
  helmetMiddleware,
  generalLimiter,
} from "./presentation/middlewares/securityMiddleware.js";
import { UPLOAD_ROOT, logUploadPaths } from "./core/constants/uploadPaths.js";

// Database
import { testConnection } from "./infrastructure/database/db.js";
import { closePrismaConnection } from "./infrastructure/database/prisma.js";

// Swagger
import { swaggerSpec } from "./infrastructure/swagger/swagger.config.js";

// Routes
import adsRoutes from "./presentation/routes/ads.routes.js";
import authRoutes from "./presentation/routes/auth.routes.js";
import postRoutes from "./presentation/routes/posts.routes.js";
import telegramRoutes from "./presentation/routes/telegram.routes.js";
import contactRoutes from "./presentation/routes/contact.routes.js";
import categoryRoutes from "./presentation/routes/categories.routes.js";
import faqRoutes from "./presentation/routes/faqs.routes.js";
import floorRuleRoutes from "./presentation/routes/floorRules.routes.js";
import carRoutes from "./presentation/routes/cars.routes.js";
import adImageRoutes from "./presentation/routes/adImages.routes.js";
import uploadRoutes from "./presentation/routes/upload.routes.js";
import nearbyRoutes from "./presentation/routes/nearby.routes.js";
import {
  userRoutes,
  publicUserRoutes,
} from "./presentation/routes/users.routes.js";
import messageRoutes from "./presentation/routes/messageRoutes.js";
import bookingRoutes from "./presentation/routes/bookingRoutes.js";
import telegramChatRoutes from "./presentation/routes/telegramChatRoutes.js";
import adminRoutes from "./presentation/routes/admin.routes.js";
import imageProxyRoutes from "./presentation/routes/imageProxy.routes.js";
import eventsRoutes from "./presentation/routes/events.routes.js";
import parkingRoutes from "./presentation/routes/parking.routes.js";
import favoritesRoutes from "./presentation/routes/favorites.routes.js";
import maxBotRoutes from "./presentation/routes/maxBot.routes.js";

// Telegram Bot
import telegramBot from "./application/services/TelegramBot.js";

// DI-контейнер (нужен для поллера MAX-бота)
import { container } from "./infrastructure/container/Container.js";

// Фронт читает id как строки (`user_id`, `ad_id` — BigInt-колонки).
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();

// Trust proxy (needed when behind nginx)
// Use 1 to trust only the first proxy (Nginx)
app.set("trust proxy", 1);

// ================== Middlewares ==================

// Security
app.use(helmetMiddleware);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3001",
  credentials: true,
};

// `cors()` сам отвечает на PREFLIGHT, поэтому отдельного `app.options("*")` не нужно.
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Rate limiting
app.use(generalLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// ================== Static Files ==================

const uploadRoot = UPLOAD_ROOT;

// Пути раздачи логов для отладки (см. core/constants/uploadPaths.js)
logUploadPaths();

/** Картинки должны переживать переход между фронтендом и CDN-подобным кэшем. */
const setUploadHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=86400"); // 1 день
};

const uploadsMiddleware = () =>
  express.static(uploadRoot, {
    immutable: false,
    maxAge: "1d",
    fallthrough: true,
    setHeaders: setUploadHeaders,
  });

// Раздаём и как `/uploads`, и как `/api/uploads` — исторически ссылки на файлы
// существуют в базе в обеих формах.
app.use("/uploads", uploadsMiddleware());
app.use("/api/uploads", uploadsMiddleware());

logger.info("Static files serving", {
  path: uploadRoot,
  routes: ["/uploads", "/api/uploads"],
  resolvedPath: path.resolve(uploadRoot),
});

// ================== API Routes ==================

// Telegram webhook (if using webhook mode)
if (process.env.TELEGRAM_WEBHOOK_URL) {
  app.use(telegramBot.getWebhookMiddleware());
  logger.info("Telegram webhook middleware registered");
}

// Все маршруты говорят на `/api` (монтируются здесь единообразно).
const apiRoutes = [
  adsRoutes,
  authRoutes,
  postRoutes,
  telegramRoutes,
  contactRoutes,
  categoryRoutes,
  faqRoutes,
  floorRuleRoutes,
  carRoutes,
  adImageRoutes,
  uploadRoutes,
  nearbyRoutes,
  publicUserRoutes,
  userRoutes,
  bookingRoutes,
  imageProxyRoutes,
  parkingRoutes,
];

for (const router of apiRoutes) {
  app.use("/api", router);
}

// Маршруты со своим префиксом
app.use("/api/messages", messageRoutes);
app.use("/api/telegram-chats", telegramChatRoutes);
app.use("/api/admin", adminRoutes);
// Вкладка админки «MAX-бот»: рассылки, входящие от жителей, настройка webhook
app.use("/api/admin/max-bot", maxBotRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/favorites", favoritesRoutes);

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Taiginsky API Docs",
  })
);

// Swagger JSON
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ================== Error Handling ==================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ================== Server Startup ==================

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Проверка БД не блокирует старт (так было заведено): при недоступной базе
// сервис поднимается и отдаёт 500 на эндпоинтах, зато доступен `/api/health`
// и мини-аппы не падают без ответа. Причина пишется в лог уровнем выше.
const databaseConnected = await testConnection().catch(() => false);

if (!databaseConnected) {
  logger.error(
    "Database connection failed — starting without it (API routes will fail)"
  );
}

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info("Server started", {
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version,
    databaseConnected,
  });

  // Start Telegram bot
  telegramBot.launch().catch((err) => {
    logger.error("Failed to start Telegram bot", { error: err.message });
  });

  // MAX Bot: сборщик входящих сообщений (long polling GET /updates).
  // Отключается переменной MAX_BOT_POLLING=false — например при переходе на
  // webhook (см. заголовку src/infrastructure/services/MaxBotUpdatePoller.js).
  if (process.env.MAX_BOT_TOKEN && process.env.MAX_BOT_POLLING !== "false") {
    try {
      container.resolve("maxBotUpdatePoller").start();
    } catch (err) {
      logger.error("Failed to start MAX bot update poller", { error: err.message });
    }
  } else {
    logger.info("MAX bot poller is not started", {
      reason: process.env.MAX_BOT_TOKEN
        ? "MAX_BOT_POLLING=false"
        : "MAX_BOT_TOKEN missing",
    });
  }

  // MAX Bot: рассылки, оставшиеся queued/running после перезапуска процесса,
  // никто не отправляет — приводим журнал в честное состояние.
  if (databaseConnected && process.env.MAX_BOT_TOKEN) {
    container
      .resolve("maxBotBroadcastUseCases")
      .reconcileInterruptedBroadcasts()
      .catch((err) =>
        logger.error("Failed to reconcile MAX bot broadcasts", {
          error: err.message,
        })
      );
  }
});

// ================== Cron Jobs ==================

/**
 * Авто-архив устаревших объявлений — дважды в сутки.
 *
 * Прежняя задача обращалась по HTTP к `/api/ads/archive-old`, которого в
 * маршрутах никогда не было, поэтому авто-архив не работал никогда. Теперь
 * кейс вызывается напрямую. `updateMany` идемпотентен, так что несколько
 * инстансов PM2 в один момент времени не испортят данные.
 */
const archiveOldAdsJob = databaseConnected
  ? cron.schedule("0 */12 * * *", async () => {
      try {
        const { archived, days } = await container
          .resolve("archiveOldAdsUseCase")
          .execute();

        logger.info("Cron: outdated ads archived", { archived, days });
      } catch (err) {
        logger.error("Cron: auto-archive failed", { error: err.message });
      }
    })
  : null;

// ================== Graceful Shutdown ==================

const SHUTDOWN_TIMEOUT_MS = 10_000;
/** Останавливаем сервис и только потом закрываем HTTP: иначе обрыв на живых запросах. */
const stopStep = async (label, stop) => {
  try {
    await stop();
  } catch (err) {
    logger.error(`Error while stopping ${label}`, { error: err.message });
  }
};

let shuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Если дождаться тишины не получилось — уходим всё равно, иначе PM2 убьёт процесс жёстко.
  const watchdog = setTimeout(() => {
    logger.error("Graceful shutdown timed out, exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  watchdog.unref();

  await stopStep("Telegram bot", () => telegramBot.stop());
  await stopStep("cron jobs", async () => archiveOldAdsJob?.stop());
  // Поллер MAX держит long-polling-запрос /updates — без остановки процесс не завершится.
  await stopStep("MAX bot poller", () =>
    container.resolve("maxBotUpdatePoller").stop()
  );

  await stopStep("HTTP server", () => {
    return new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  await stopStep("database connection", () => closePrismaConnection());

  clearTimeout(watchdog);
  logger.info("Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  process.exit(1);
});

export default app;
