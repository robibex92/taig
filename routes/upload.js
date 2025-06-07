import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const API_URL = process.env.API_URL || "https://api.asicredinvest.md/api-v1";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../Uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const finalExt = !ext || /\.(heic|heif)$/i.test(ext) ? ".jpg" : ext;
    const uniqueName = `${Date.now()}-${Math.floor(
      Math.random() * 1e8
    )}${finalExt}`;
    console.log(
      `Processing file: ${file.originalname}, MIME: ${file.mimetype}, Final ext: ${finalExt}`
    );
    cb(null, uniqueName);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", upload.array("photos", 10), (req, res) => {
  console.log(
    "Upload request received. Files:",
    req.files
      ? req.files.map((f) => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
        }))
      : "No files"
  );
  if (!req.files || req.files.length === 0)
    return res
      .status(400)
      .json({ success: false, message: "No files uploaded." });

  const fileUrls = req.files.map(
    (file) => `${API_URL}/uploads/${file.filename}`
  );
  console.log("Successfully processed files. URLs:", fileUrls);
  res.json({ success: true, fileUrls });
});

router.use("/uploads", express.static(path.join(__dirname, "../Uploads")));

router.delete("/delete-image", async (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath)
      return res
        .status(400)
        .json({ success: false, message: "Не указан путь к файлу" });

    const uploadsDir = path.join(__dirname, "../Uploads");
    const fileName = path.basename(relPath);
    const filePath = path.join(uploadsDir, fileName);

    if (!filePath.startsWith(uploadsDir))
      return res
        .status(400)
        .json({ success: false, message: "Некорректный путь" });
    if (!fs.existsSync(filePath))
      return res
        .status(404)
        .json({ success: false, message: "Файл не найден" });

    await fs.promises.unlink(filePath);
    return res.json({ success: true, message: "Файл удалён" });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Ошибка при удалении файла",
      error: err.message,
    });
  }
});

export default router;
