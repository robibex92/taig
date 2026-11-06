/* eslint-env jest */
/**
 * Видимость фотографий объявления.
 *
 * `GET /api/ad-images?ad_id=` и `GET /api/ads/:id/images` были открыты всем без
 * исключения. Само объявление по этой же ссылке модератор уже не находит
 * (`GetAdByIdUseCase`), а его снимки — находил: «удалил объявление» оставляло
 * фотографии доступными по id.
 */

import { GetAdImagesUseCase } from "../../../application/use-cases/adImage/GetAdImagesUseCase.js";
import { GetImagesByIdUseCase } from "../../../application/use-cases/adImage/GetImagesByIdUseCase.js";

const owner = { user_id: 7n, roles: [] };
const stranger = { user_id: 8n, roles: [] };
const moderator = { user_id: 9n, roles: ["global:moderator"] };

const adRepository = (status) => ({
  findById: async () => ({ id: 1n, user_id: 7n, status }),
});

const emptyAdRepository = { findById: async () => null };

const imageRepository = () => {
  const calls = { byAd: [], byPost: [] };
  return {
    calls,
    findByAdId: async (id) => {
      calls.byAd.push(id);
      return [{ id: 1n, ad_id: 1n, image_url: "/uploads/a.jpg" }];
    },
    findByPostId: async (id) => {
      calls.byPost.push(id);
      return [{ id: 2n, post_id: id, image_url: "/uploads/p.jpg" }];
    },
  };
};

describe("GetAdImagesUseCase", () => {
  it("активное объявление отдаёт снимки гостю", async () => {
    const repo = imageRepository();
    const useCase = new GetAdImagesUseCase(repo, adRepository("active"));

    const images = await useCase.execute(1, null, null);

    expect(images).toHaveLength(1);
    expect(repo.calls.byAd).toEqual([1]);
  });

  it("снятое и удалённое объявление анониму и чужому — пустой список", async () => {
    for (const status of ["archive", "deleted", "draft"]) {
      const repo = imageRepository();
      const useCase = new GetAdImagesUseCase(repo, adRepository(status));

      await expect(useCase.execute(1, null, null)).resolves.toEqual([]);
      await expect(useCase.execute(1, null, stranger)).resolves.toEqual([]);
      expect(repo.calls.byAd).toEqual([]);
    }
  });

  it("автор и модерация видят снимки своего архива", async () => {
    const useCase = new GetAdImagesUseCase(imageRepository(), adRepository("archive"));

    expect(await useCase.execute(1, null, owner)).toHaveLength(1);
    expect(await useCase.execute(1, null, moderator)).toHaveLength(1);
  });

  it("снимки заметки остаются публичными", async () => {
    const repo = imageRepository();
    const useCase = new GetAdImagesUseCase(repo, adRepository("deleted"));

    const images = await useCase.execute(null, 5, null);

    expect(repo.calls.byPost).toEqual([5]);
    expect(images[0].post_id).toBe(5);
  });
});

describe("GetImagesByIdUseCase", () => {
  it("id существует как объявление — снимки заметок не подмешиваются", async () => {
    const repo = imageRepository();
    repo.findByAdId = async () => [];
    const useCase = new GetImagesByIdUseCase(repo, adRepository("active"));

    await expect(useCase.execute(1, null)).resolves.toEqual([]);
    expect(repo.calls.byPost).toEqual([]);
  });

  it("снятое объявление чужому — пусто, и до заметки дело не доходит", async () => {
    const repo = imageRepository();
    const useCase = new GetImagesByIdUseCase(repo, adRepository("deleted"));

    await expect(useCase.execute(1, stranger)).resolves.toEqual([]);
    expect(repo.calls.byPost).toEqual([]);
  });

  it("если id не объявление, он читается как заметка", async () => {
    const repo = imageRepository();
    const useCase = new GetImagesByIdUseCase(repo, emptyAdRepository);

    const images = await useCase.execute(5, null);

    expect(repo.calls.byPost).toEqual([5]);
    expect(images[0].image_url).toBe("/uploads/p.jpg");
  });
});
