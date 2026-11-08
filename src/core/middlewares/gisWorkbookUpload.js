import multer from "multer";
import path from "path";
import { ValidationError } from "../errors/AppError.js";

/**
 * Загрузка выгрузки ГИС ЖКХ в память процесса.
 *
 * На диск ничего не кладём: файл разбирается и забывается (бандл A ничего не
 * сохраняет), а `uploads/` отдаётся с того же origins, что и приложение, так что
 * произвольный контейнер там лишён смысла. Потолок 5 МБ с запасом покрывает эти
 * выгрузки (~41 КБ) и не даёт целиком забить память запросом.
 */
const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const gisWorkbookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_WORKBOOK_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(String(file.originalname ?? "")).toLowerCase();

    if (file.mimetype === XLSX_MIME || extension === ".xlsx") return cb(null, true);

    // `.xls` (старый бинарный формат) этим читателем не разбирается — честнее
    // сказать об этом сразу, чем упасть на «каталог содержимого не найден».
    cb(new ValidationError("Нужен файл .xlsx — выгрузка ГИС ЖКХ по голосованию"));
  },
}).single("file");
