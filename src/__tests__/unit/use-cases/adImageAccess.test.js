/* eslint-env jest */
/**
 * Право менять фотографии объявления и заметки.
 *
 * До этой правки маршруты `/api/ad-images` были открыты совсем (в jsdoc так и
 * стояло: «add auth middleware if needed»): аноним мог приписать снимок к
 * любому `ad_id`, удалить любой файл по id и сделать его главным. Проверяем,
 * что цель берётся из строки `ad_images`, а не из тела запроса.
 */

import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import { CreateAdImagesUseCase } from "../../../application/use-cases/adImage/CreateAdImagesUseCase.js";
import { DeleteAdImageUseCase } from "../../../application/use-cases/adImage/DeleteAdImageUseCase.js";
import { DeleteMultipleAdImagesUseCase } from "../../../application/use-cases/adImage/DeleteMultipleAdImagesUseCase.js";
import { SetMainImageUseCase } from "../../../application/use-cases/adImage/SetMainImageUseCase.js";

const owner = { user_id: 7n, roles: [] };
const stranger = { user_id: 8n, roles: ["resident"] };
const moderator = { user_id: 1n, roles: ["global:moderator"] };

// Два объявления: своё (7) и чужое (8). Второе нужно, чтобы проверить пачку,
// где хотя бы один снимок принадлежит другому жильцу.
const adRepository = {
  findById: async (id) =>
    ({ "1": { id: 1n, user_id: 7n, status: "active" }, "2": { id: 2n, user_id: 8n, status: "active" } })[
      String(id)
    ] ?? null,
};

const postRepository = {
  findById: async (id) => (String(id) === "5" ? { id: 5n } : null),
};

const image = (overrides) => ({
  id: 40n,
  ad_id: 1n,
  post_id: null,
  image_url: "/uploads/a.jpg",
  ...overrides,
});

const imageRepositoryFor = (row) => {
  const calls = { created: [], deleted: [], main: [] };

  return {
    calls,
    findById: async () => row,
    createMultiple: async (adId, postId, images) => {
      calls.created.push({ adId, postId, count: images.length });
      return images.map((url, index) => ({ id: BigInt(index + 1), image_url: url }));
    },
    deleteById: async (id) => {
      calls.deleted.push(id);
      return true;
    },
    deleteMultiple: async (ids) => {
      calls.deleted.push(...ids);
      return ids.length;
    },
    setMainImage: async (imageId, adId, postId) => {
      calls.main.push({ imageId, adId, postId });
      return true;
    },
  };
};

describe("CreateAdImagesUseCase", () => {
  const useCase = new CreateAdImagesUseCase(imageRepositoryFor(null), adRepository, postRepository);

  it("автор добавляет фото своего объявления", async () => {
    const repo = imageRepositoryFor(null);
    await new CreateAdImagesUseCase(repo, adRepository, postRepository).execute(
      1,
      null,
      ["/uploads/a.jpg"],
      "http://x",
      owner
    );

    expect(repo.calls.created).toEqual([{ adId: 1, postId: null, count: 1 }]);
  });

  it("чужое объявление не дополнить", async () => {
    await expect(
      useCase.execute(1, null, ["/uploads/a.jpg"], "http://x", stranger)
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("фото заметки — только модерации", async () => {
    await expect(
      useCase.execute(null, 5, ["/uploads/a.jpg"], "http://x", owner)
    ).rejects.toBeInstanceOf(AuthorizationError);

    const repo = imageRepositoryFor(null);
    await new CreateAdImagesUseCase(repo, adRepository, postRepository).execute(
      null,
      5,
      ["/uploads/a.jpg"],
      "http://x",
      moderator
    );

    expect(repo.calls.created[0].postId).toBe(5);
  });

  it("несуществующий объект — 404, а не сирота в базе", async () => {
    await expect(
      useCase.execute(999, null, ["/uploads/a.jpg"], "http://x", owner)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("без цели создание запрещено", async () => {
    await expect(
      useCase.execute(null, null, ["/uploads/a.jpg"], "http://x", owner)
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("DeleteAdImageUseCase", () => {
  it("чужой снимок не удалить", async () => {
    const repo = imageRepositoryFor(image());
    const useCase = new DeleteAdImageUseCase(repo, adRepository, postRepository);

    await expect(useCase.execute(40, stranger)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(repo.calls.deleted).toEqual([]);
  });

  it("свой снимок удаляется", async () => {
    const repo = imageRepositoryFor(image());
    const useCase = new DeleteAdImageUseCase(repo, adRepository, postRepository);

    await expect(useCase.execute(40, owner)).resolves.toBe(true);
    expect(repo.calls.deleted).toEqual([40]);
  });
});

describe("DeleteMultipleAdImagesUseCase", () => {
  it("один чужой снимок отменяет всю пачку", async () => {
    const mine = image({ id: 1n, ad_id: 1n });
    const foreign = image({ id: 2n, ad_id: 2n });
    const repo = {
      deleted: [],
      findById: async (id) => (String(id) === "1" ? mine : foreign),
      deleteMultiple: async (ids) => {
        repo.deleted.push(...ids);
        return ids.length;
      },
    };
    const useCase = new DeleteMultipleAdImagesUseCase(repo, adRepository, postRepository);

    await expect(useCase.execute([1, 2], owner)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(repo.deleted).toEqual([]);
  });
});

describe("SetMainImageUseCase", () => {
  it("главной становится снимок своего объявления", async () => {
    const repo = imageRepositoryFor(image());
    const useCase = new SetMainImageUseCase(repo, adRepository, postRepository);

    await useCase.execute(40, owner);

    // Хозяин взят из строки `ad_images` (`ad_id: 1n`), а не из тела запроса.
    expect(repo.calls.main).toEqual([{ imageId: 40, adId: 1n, postId: null }]);
  });

  it("чужой снимок главным не сделать", async () => {
    const repo = imageRepositoryFor(image());
    const useCase = new SetMainImageUseCase(repo, adRepository, postRepository);

    await expect(useCase.execute(40, stranger)).rejects.toBeInstanceOf(
      AuthorizationError
    );
    expect(repo.calls.main).toEqual([]);
  });

  it("снимок без хозяина правит только модерация", async () => {
    const repo = imageRepositoryFor(image({ ad_id: null, post_id: null }));
    const useCase = new SetMainImageUseCase(repo, adRepository, postRepository);

    await expect(useCase.execute(40, owner)).rejects.toBeInstanceOf(
      AuthorizationError
    );

    const moderatorRepo = imageRepositoryFor(image({ ad_id: null, post_id: null }));
    await new SetMainImageUseCase(
      moderatorRepo,
      adRepository,
      postRepository
    ).execute(40, moderator);

    expect(moderatorRepo.calls.main).toHaveLength(1);
  });
});
