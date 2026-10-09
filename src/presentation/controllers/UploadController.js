import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { AuthorizationError, ValidationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";
import { buildServerUrl } from "../../core/utils/requestUrl.js";
import { isModerator } from "../../core/utils/roles.js";
import { validate } from "../../core/validation/validator.js";
import { sweepUploadsQuerySchema } from "../../core/validation/schemas/upload.schema.js";

/**
 * Upload Controller
 * Handles file upload and deletion operations
 */
export class UploadController {
  constructor(
    fileUploadService,
    uploadedFileRepository,
    deleteUploadUseCase,
    sweepOrphanUploadsUseCase
  ) {
    this.fileUploadService = fileUploadService;
    this.uploadedFileRepository = uploadedFileRepository;
    this.deleteUploadUseCase = deleteUploadUseCase;
    this.sweepOrphanUploadsUseCase = sweepOrphanUploadsUseCase;
  }

  /**
   * POST /api-v1/upload
   * Upload multiple files (up to 10)
   */
  uploadFiles = asyncHandler(async (req, res) => {
    logger.info("Upload request received", {
      filesCount: req.files ? req.files.length : 0,
    });

    if (!req.files || req.files.length === 0) {
      throw new ValidationError("No files uploaded");
    }

    // Имя файла должно соответствовать его байтам: HEIC с расширением .jpg
    // браузер не рисует, а `Content-Type` берётся именно из расширения.
    await this.fileUploadService.normalizeStored(req.files);

    const serverUrl = buildServerUrl(req);
    const fileUrls = this.fileUploadService.getFileUrls(req.files, serverUrl);

    // Кто принёс файл — записываем сразу: без этого удаления не отличить своё
    // от чужого, а уборка не знает, что файл уже никому не нужен.
    await this.uploadedFileRepository.record(
      req.files.map((file) => file.filename),
      req.user?.user_id
    );

    logger.info("Files uploaded successfully", {
      count: fileUrls.length,
      urls: fileUrls,
    });

    res.json({
      success: true,
      fileUrls,
    });
  });

  /**
   * DELETE /api-v1/upload/delete-image
   * Delete a file
   */
  deleteFile = asyncHandler(async (req, res) => {
    const result = await this.deleteUploadUseCase.execute(req.query.path, req.user);

    res.json({
      success: true,
      message: "File deleted",
      ...result,
    });
  });

  /**
   * POST /api-v1/upload/sweep
   * Список (и, по запросу, удаление) файлов, которые никто не использует.
   * Разрушающий шаг только явный: `dry_run=false`.
   */
  sweep = asyncHandler(async (req, res) => {
    if (!isModerator(req.user)) {
      throw new AuthorizationError("Уборкой файлов занимается модерация");
    }

    const { older_than_hours: olderThanHours, dry_run: dryRun } = validate(
      sweepUploadsQuerySchema,
      req.query
    );

    const report = await this.sweepOrphanUploadsUseCase.execute({
      olderThanHours,
      dryRun,
    });

    res.json({ success: true, ...report });
  });
}
