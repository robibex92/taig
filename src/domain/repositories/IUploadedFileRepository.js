/**
 * Контракт репозитория загруженных файлов.
 *
 * Файл лежит на диске, а запись в `uploaded_files` — единственный способ узнать,
 * кто его принёс. Нужен ли файл кому-то, решается по ссылкам в других таблицах
 * (`countReferences`), а не по записи: файл мог быть загружен до появления этой
 * таблицы.
 */
export class IUploadedFileRepository {
  async record(filenames, userId) {
    throw new Error("Method 'record()' must be implemented");
  }

  async findByFilename(filename) {
    throw new Error("Method 'findByFilename()' must be implemented");
  }

  async countReferences(filename) {
    throw new Error("Method 'countReferences()' must be implemented");
  }

  async forget(filenames) {
    throw new Error("Method 'forget()' must be implemented");
  }
}
