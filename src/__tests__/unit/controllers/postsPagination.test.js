import { describe, it, expect, beforeEach } from "@jest/globals";

import { PostController } from "../../../presentation/controllers/PostController.js";
import { GetPostsUseCase } from "../../../application/use-cases/post/GetPostsUseCase.js";

/**
 * `GET /api/posts` теперь отвечает страницей.
 *
 * Форма ответа важна фронту: `hasMore` решает, показывать ли «Показать ещё»,
 * а `total` — сколько новостей всего. Проверка закреплена тестом, потому что
 * молча вернуть «последнюю» страницу при неполной выборке — это пустая лента
 * без единой ошибки в логах.
 */

const calls = [];

const postRepository = {
  findAll: async (filters) => {
    calls.push({ method: "findAll", filters });
    return [{ id: 1n }, { id: 2n }];
  },
  findPage: async (filters, page, limit) => {
    calls.push({ method: "findPage", filters, page, limit });
    return { posts: [{ id: 1n }, { id: 2n }], total: 5 };
  },
};

const controller = new PostController(new GetPostsUseCase(postRepository));

const respond = (query) =>
  new Promise((resolve, reject) => {
    const res = {
      status: () => res,
      json: resolve,
    };

    controller.getPosts({ query }, res, reject);
  });

beforeEach(() => {
  calls.length = 0;
});

describe("getPosts", () => {
  it("отдаёт страницу и честный hasMore", async () => {
    const body = await respond({ status: "active", page: 1, limit: 2 });

    expect(calls[0]).toMatchObject({ method: "findPage", page: 1, limit: 2 });
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasMore: true,
    });
  });

  it("последняя страница не обещает следующую", async () => {
    const body = await respond({ page: 3, limit: 2 });

    expect(body.pagination.hasMore).toBe(false);
  });

  it("дефолты берёт из схемы, а не из воздуха", async () => {
    const body = await respond({});

    expect(calls[0].filters.status).toBe("active");
    expect(body.pagination).toMatchObject({ page: 1, limit: 10 });
  });
});
