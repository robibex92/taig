import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../../Uploads");

    if (!fs.existsSync(uploadDir)) {
      logger.info("Creating upload directory", { path: uploadDir });
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    // Convert HEIC/HEIF to JPG
    const finalExt = !ext || /\.(heic|heif)$/i.test(ext) ? ".jpg" : ext;
    const uniqueName = `${Date.now()}-${Math.floor(
      Math.random() * 1e8
    )}${finalExt}`;

    logger.debug("Processing file upload", {
      original: file.originalname,
      mime: file.mimetype,
      extension: finalExt,
    });

    cb(null, uniqueName);
  },
});

// Configure multer
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
