/* eslint-env jest */
/**
 * Кто вправе открыть объявление по прямой ссылке.
 *
 * Снятое с публикации и удалённое объявление раньше оставалось доступным всем:
 * ссылка, брошенная в чат до удаления, работала вечно.
 */

import { GetAdByIdUseCase } from "../../../application/use-cases/ad/GetAdByIdUseCase.js";
import { NotFoundError } from "../../../core/errors/AppError.js";

const owner = { user_id: 7n, roles: [] };
const stranger = { user_id: 8n, roles: [] };
const moderator = { user_id: 9n, roles: ["global:moderator"] };

const ad = (status) => ({
  id: 1n,
  user_id: 7n,
  status,
  view_count: 3,
  incrementViewCount() {
    this.view_count += 1;
  },
});

const repositoryFor = (row) => ({
  findById: async () => row,
  incrementViewCount: async () => {},
});

const open = (status, viewer) =>
  new GetAdByIdUseCase(repositoryFor(ad(status))).execute(1, false, viewer);

describe("GetAdByIdUseCase", () => {
  it("активное объявление открыто всем, включая гостя", async () => {
    await expect(open("active", null)).resolves.toMatchObject({ id: 1n });
    await expect(open("active", stranger)).resolves.toMatchObject({ id: 1n });
  });

  it("неактивное объявление скрыто от чужих", async () => {
    for (const status of ["archive", "deleted", "draft"]) {
      await expect(open(status, null)).rejects.toBeInstanceOf(NotFoundError);
      await expect(open(status, stranger)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("владелец и модерация видят своё снятое объявление", async () => {
    await expect(open("archive", owner)).resolves.toMatchObject({ status: "archive" });
    await expect(open("deleted", moderator)).resolves.toMatchObject({
      status: "deleted",
    });
  });

  it("BigInt владельца сравнивается со строкой из запроса", async () => {
    // `user_id` из Prisma — BigInt, из HTTP-параметра — строка: `===` дало бы
    // false, и автор не узнал бы собственное объявление.
    await expect(open("archive", { user_id: "7", roles: [] })).resolves.toBeTruthy();
  });

  it("просмотр засчитывается только там, где объявление видно", async () => {
    const incremented = [];
    const repo = {
      findById: async () => ad("archive"),
      incrementViewCount: async (id) => incremented.push(id),
    };
    const useCase = new GetAdByIdUseCase(repo);

    await expect(useCase.execute(1, true, stranger)).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(incremented).toEqual([]);

    const result = await useCase.execute(1, true, owner);
    expect(result.view_count).toBe(4);
  });

  it("несуществующее объявление — тот же 404", async () => {
    const useCase = new GetAdByIdUseCase({ findById: async () => null });
    await expect(useCase.execute(999, false, owner)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
