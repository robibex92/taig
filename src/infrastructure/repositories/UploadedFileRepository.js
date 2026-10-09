import { prisma } from "../database/prisma.js";
import { IUploadedFileRepository } from "../../domain/repositories/IUploadedFileRepository.js";

/**
 * Где файл считается нужным: на него ссылается фото объявления, новость,
 * событие, снимок автомобиля или аватар жителя (обычный и из MAX).
 *
 * Снимки в `telegram_messages.url_img` в счёт не идут: копия картинки уже
 * улетела на серверы Telegram, а запись — память о публикации, а не владелец
 * файла.
 */
const referenceQueries = (filename) => [
  prisma.adImage.count({ where: { image_url: { endsWith: filename } } }),
  prisma.post.count({ where: { image_url: { endsWith: filename } } }),
  prisma.event.count({ where: { image_url: { endsWith: filename } } }),
  prisma.carImage.count({ where: { image_url: { endsWith: filename } } }),
  prisma.user.count({
    where: {
      OR: [
        { avatar: { endsWith: filename } },
        { max_avatar: { endsWith: filename } },
      ],
    },
  }),
];

/**
 * UploadedFile Repository Implementation with Prisma
 * Кто принёс файл и нужен ли он ещё кому-то
 */
export class UploadedFileRepository extends IUploadedFileRepository {
  /**
   * Файлы приняты: помечаем принёсшего. Повторная запись того же имени
   * возможна (имя генерируется из времени и случайного числа), поэтому
   * `skipDuplicates`.
   */
  async record(filenames, userId) {
    const data = (filenames ?? [])
      .filter(Boolean)
      .map((filename) => ({ filename, uploaded_by: userId ? BigInt(userId) : null }));

    if (data.length === 0) return 0;

    const result = await prisma.uploadedFile.createMany({ data, skipDuplicates: true });

    return result.count;
  }

  async findByFilename(filename) {
    return prisma.uploadedFile.findUnique({ where: { filename } });
  }

  /**
   * Число ссылок на файл. Ищем по окончанию имени, потому что в базе лежат
   * разные формы одной ссылки: `/uploads/x.jpg`, `/api/uploads/x.jpg` и
   * абсолютный адрес.
   */
  async countReferences(filename) {
    if (!filename) return 0;

    const counts = await Promise.all(referenceQueries(filename));

    return counts.reduce((total, count) => total + count, 0);
  }

  /** Запись убирается вместе с файлом: владеть нечем, хранить нечего. */
  async forget(filenames) {
    if (!filenames?.length) return 0;

    const result = await prisma.uploadedFile.deleteMany({
      where: { filename: { in: filenames } },
    });

    return result.count;
  }
}
