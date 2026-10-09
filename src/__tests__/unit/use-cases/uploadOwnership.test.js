import { describe, it, expect, beforeEach } from "@jest/globals";

import { DeleteUploadUseCase } from "../../../application/use-cases/upload/DeleteUploadUseCase.js";
import { SweepOrphanUploadsUseCase } from "../../../application/use-cases/upload/SweepOrphanUploadsUseCase.js";
import { AuthorizationError } from "../../../core/errors/AppError.js";

/**
 * Чей файл и нужен ли он.
 *
 * `/api/upload` кладёт файл на диск, и до появления `uploaded_files` любой
 * вошедший мог стереть любой файл по имени, а неиспользуемое оставалось в
 * каталоге навсегда. Здесь — оба правила: кто имеет право удалять и что
 * считается сиротой.
 */

const owner = { user_id: 7n, roles: [] };
const neighbour = { user_id: 8n, roles: [] };
const moderator = { user_id: 9n, roles: ["global:moderator"] };

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

class FakeUploadedFileRepository {
  constructor(rows = {}, references = {}) {
    this.rows = rows;
    this.references = references;
    this.forgotten = [];
    this.recorded = [];
  }

  async findByFilename(filename) {
    return this.rows[filename] ?? null;
  }

  async countReferences(filename) {
    return this.references[filename] ?? 0;
  }

  async forget(filenames) {
    this.forgotten.push(...filenames);
    return filenames.length;
  }

  async record(filenames, userId) {
    this.recorded.push({ filenames, userId });
    return filenames.length;
  }
}

class FakeFileUploadService {
  constructor(files = []) {
    this.files = files;
    this.deleted = [];
  }

  async deleteFile(filename) {
    this.deleted.push(filename);
    return true;
  }

  async listStoredFiles() {
    return this.files;
  }

  async removeStoredFile(absolutePath) {
    this.deleted.push(absolutePath);
  }
}

const storedFile = (name, { hours = 100, size = 1024 } = {}) => ({
  filename: name,
  relativePath: name,
  absolutePath: `/var/uploads/${name}`,
  sizeBytes: size,
  modifiedAt: hoursAgo(hours),
});

let repo;
let service;

beforeEach(() => {
  repo = null;
  service = null;
});

describe("DeleteUploadUseCase", () => {
  const useCase = () => new DeleteUploadUseCase(repo, service);

  it("свой файл удаляется, запись о нём забывается", async () => {
    repo = new FakeUploadedFileRepository({ "a.jpg": { uploaded_by: 7n } }, { "a.jpg": 1 });
    service = new FakeFileUploadService();

    const result = await useCase().execute("/uploads/a.jpg", owner);

    expect(result).toMatchObject({ filename: "a.jpg", references: 1 });
    expect(service.deleted).toEqual(["a.jpg"]);
    expect(repo.forgotten).toEqual(["a.jpg"]);
  });

  it("чужой востребованный файл не удаляется", async () => {
    repo = new FakeUploadedFileRepository({ "a.jpg": { uploaded_by: 7n } }, { "a.jpg": 2 });
    service = new FakeFileUploadService();

    await expect(useCase().execute("/uploads/a.jpg", neighbour)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(service.deleted).toEqual([]);
  });

  it("чужой, но уже не нужный файл тоже остаётся: его принёс не ты", async () => {
    repo = new FakeUploadedFileRepository({ "a.jpg": { uploaded_by: 7n } }, {});
    service = new FakeFileUploadService();

    await expect(useCase().execute("/uploads/a.jpg", neighbour)).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("модерация убирает чужой файл, если он участвует в записях", async () => {
    repo = new FakeUploadedFileRepository({ "a.jpg": { uploaded_by: 7n } }, { "a.jpg": 3 });
    service = new FakeFileUploadService();

    await expect(useCase().execute("/uploads/a.jpg", moderator)).resolves.toMatchObject({
      references: 3,
    });
  });

  it("файл без записи удаляется, только если на него никто не ссылается", async () => {
    repo = new FakeUploadedFileRepository({}, { "old.jpg": 0, "used.jpg": 1 });
    service = new FakeFileUploadService();

    await expect(useCase().execute("/uploads/old.jpg", neighbour)).resolves.toBeTruthy();
    await expect(useCase().execute("/uploads/used.jpg", neighbour)).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("пустой путь — ошибка запроса, а не попытка удалить каталог", async () => {
    repo = new FakeUploadedFileRepository();
    service = new FakeFileUploadService();

    await expect(useCase().execute("", owner)).rejects.toThrow(/путь к файлу/i);
  });
});

describe("SweepOrphanUploadsUseCase", () => {
  const useCase = () => new SweepOrphanUploadsUseCase(repo, service);

  const files = [
    storedFile("fresh.jpg", { hours: 2 }),
    storedFile("used.jpg", { hours: 200 }),
    storedFile("orphan.jpg", { hours: 200, size: 4096 }),
  ];

  it("показывает сирот, ничего не удаляя", async () => {
    repo = new FakeUploadedFileRepository({}, { "used.jpg": 1 });
    service = new FakeFileUploadService(files);

    const report = await useCase().execute();

    expect(report.dryRun).toBe(true);
    expect(report.scanned).toBe(3);
    expect(report.orphans.map((orphan) => orphan.path)).toEqual(["orphan.jpg"]);
    expect(report.freedBytes).toBe(4096);
    expect(service.deleted).toEqual([]);
  });

  it("удаляет только свежие-не-нужные и убирает записи", async () => {
    repo = new FakeUploadedFileRepository(
      { "orphan.jpg": { uploaded_by: 7n } },
      { "used.jpg": 1 }
    );
    service = new FakeFileUploadService(files);

    const report = await useCase().execute({ olderThanHours: 48, dryRun: false });

    expect(report.orphans.map((orphan) => orphan.path)).toEqual(["orphan.jpg"]);
    expect(service.deleted).toEqual(["/var/uploads/orphan.jpg"]);
    expect(repo.forgotten).toEqual(["orphan.jpg"]);
  });

  it("файл моложе срока в сироты не попадает", async () => {
    repo = new FakeUploadedFileRepository({}, {});
    service = new FakeFileUploadService(files);

    const report = await useCase().execute({ olderThanHours: 24 });

    // fresh.jpg лежит два часа — мог быть выбран в открытой форме, не трогаем.
    expect(report.orphans.map((orphan) => orphan.path)).toEqual(["used.jpg", "orphan.jpg"]);
  });
});
