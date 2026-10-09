import path from "path";

import {
  AuthorizationError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import { isModerator } from "../../../core/utils/roles.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Удаление загруженного файла.
 *
 * Право одно: файл свой или ты модератор. «Свой» — это запись в
 * `uploaded_files`; файл, загруженный до появления таблицы, считается ничейным:
 * его можно убрать, только если на него никто не ссылается.
 */
export class DeleteUploadUseCase {
  constructor(uploadedFileRepository, fileUploadService) {
    this.uploadedFileRepository = uploadedFileRepository;
    this.fileUploadService = fileUploadService;
  }

  async execute(relPath, user) {
    const filename = path.basename(String(relPath ?? ""));

    if (!filename) {
      throw new ValidationError("Нужен путь к файлу");
    }

    const [record, references] = await Promise.all([
      this.uploadedFileRepository.findByFilename(filename),
      this.uploadedFileRepository.countReferences(filename),
    ]);

    const isOwner = Boolean(record?.uploaded_by) &&
      String(record.uploaded_by) === String(user?.user_id ?? "");

    if (!isOwner && !isModerator(user)) {
      if (references > 0) {
        throw new AuthorizationError("Файл участвует в записях портала");
      }

      if (record) {
        throw new AuthorizationError("Файл загрузил не вы");
      }
    }

    await this.fileUploadService.deleteFile(filename);
    await this.uploadedFileRepository.forget([filename]);

    logger.info("Upload deleted", {
      filename,
      user_id: user?.user_id,
      references,
    });

    return { filename, references };
  }
}
