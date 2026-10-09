import { logger } from "../../../core/utils/logger.js";

/** Столько часов файл считается «только что загруженным»: объявление мог
 * не дослать человек, у которого открыта форма. */
const DEFAULT_GRACE_HOURS = 48;

/**
 * Уборка сирот в каталоге загрузок.
 *
 * Ссылку на файл держат объявления, новости, события, снимки автомобилей и
 * аватары; всё остальное — то, что кто-то выбрал и не сохранил. Обход идёт по
 * диску, а не по таблице, поэтому файлы, загруженные до появления
 * `uploaded_files`, тоже попадают в уборку.
 *
 * По умолчанию — прогон без удаления: список того, что будет убрано, нужно
 * посмотреть до разрушающего шага.
 */
export class SweepOrphanUploadsUseCase {
  constructor(uploadedFileRepository, fileUploadService) {
    this.uploadedFileRepository = uploadedFileRepository;
    this.fileUploadService = fileUploadService;
  }

  async execute({ olderThanHours = DEFAULT_GRACE_HOURS, dryRun = true } = {}) {
    const files = await this.fileUploadService.listStoredFiles();
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;

    const orphans = [];

    for (const file of files) {
      if (file.modifiedAt.getTime() >= cutoff) continue;

      const references = await this.uploadedFileRepository.countReferences(file.filename);

      if (references > 0) continue;

      orphans.push(file);
    }

    if (!dryRun) {
      for (const file of orphans) {
        await this.fileUploadService.removeStoredFile(file.absolutePath);
      }

      await this.uploadedFileRepository.forget(orphans.map((file) => file.filename));

      logger.info("Orphan uploads swept", {
        removed: orphans.length,
        freedBytes: orphans.reduce((sum, file) => sum + file.sizeBytes, 0),
        olderThanHours,
      });
    }

    return {
      scanned: files.length,
      olderThanHours,
      dryRun,
      freedBytes: orphans.reduce((sum, file) => sum + file.sizeBytes, 0),
      orphans: orphans.map((file) => ({
        path: file.relativePath,
        sizeBytes: file.sizeBytes,
        modifiedAt: file.modifiedAt.toISOString(),
      })),
    };
  }
}
