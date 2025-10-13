import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
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

// Database
import { testConnection } from "./infrastructure/database/db.js";

// Swagger
import { swaggerSpec } from "./infrastructure/swagger/swagger.config.js";

// Routes
import adsRoutes from "./presentation/routes/ads.routes.js";
import authRoutes from "./presentation/routes/auth.routes.js";
import postRoutes from "./presentation/routes/posts.routes.js";
import telegramRoutes from "./presentation/routes/telegram.routes.js";
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

// Load environment variables
dotenv.config();

// Fix BigInt serialization for JSON
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Trust proxy (needed when behind nginx)
app.set("trust proxy", true);

// ================== Middlewares ==================

// Security
app.use(helmetMiddleware);

// CORS
app.use(
  cors({
    credentials: true,
  })
);

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

const uploadsStaticPath = path.join(__dirname, "../../Uploads");
app.use("/uploads", express.static(uploadsStaticPath));
logger.info("Static files serving", { path: uploadsStaticPath });

// ================== API Routes ==================

// ================== Clean Architecture Routes (v1) ==================
app.use(adsRoutes);
app.use(authRoutes);
app.use(postRoutes);
app.use(telegramRoutes);
app.use(categoryRoutes);
app.use(faqRoutes);
app.use(floorRuleRoutes);
app.use(carRoutes);
app.use(adImageRoutes);
app.use(uploadRoutes);
app.use(nearbyRoutes);
app.use(publicUserRoutes);
app.use(userRoutes);

// ================== Legacy Routes - ALL MIGRATED! 🎉 ==================
// app.use(routerPosts); // MIGRATED ✅
// app.use("/api/telegram", oldTelegramRoutes); // MIGRATED ✅
// app.use(routerCategories); // MIGRATED ✅
// app.use(routerFaqs); // MIGRATED ✅
// app.use(routerFloorRules); // MIGRATED ✅
// app.use(routerCars); // MIGRATED ✅
// app.use(routerAdImages); // MIGRATED ✅
// app.use("/api/upload", uploadRouter); // MIGRATED ✅
// app.use(routerNearby); // MIGRATED ✅

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

// ================== Cron Jobs ==================

// Archive old ads every 12 hours
cron.schedule("0 */12 * * *", async () => {
  try {
    const port = process.env.PORT || 4000;
    const res = await fetch(`http://localhost:${port}/api/ads/archive-old`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    logger.info("Cron job: Archive old ads", { message: data.message });
  } catch (err) {
    logger.error("Cron job: Archive old ads failed", { error: err.message });
  }
});

// ================== Server Startup ==================

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Test database connection before starting server
testConnection().then((connected) => {
  if (!connected) {
    logger.error("Failed to connect to database. Exiting...");
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info("Server started", {
      port: PORT,
      environment: NODE_ENV,
      nodeVersion: process.version,
    });
  });
});

// ================== Graceful Shutdown ==================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close server
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
