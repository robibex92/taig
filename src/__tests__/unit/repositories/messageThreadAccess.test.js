/* eslint-env jest */
/**
 * Личная переписка доступна только её участникам.
 *
 * Причина, из-за которой это вообще появилось: `GET /api/messages/thread/:threadId`
 * фильтровал только по `thread_id`, а маршрут требовал лишь авторизации. То есть
 * любой вошедший перебирал номера и читал чужие диалоги вместе с именами сторон.
 */

import { jest, describe, it, expect } from "@jest/globals";

const capturedWhere = [];

const prisma = {
  message: {
    findMany: async ({ where }) => {
      capturedWhere.push(where);
      return [];
    },
  },
};

await jest.unstable_mockModule(
  "../../../infrastructure/database/prisma.js",
  () => ({ prisma })
);

const { default: MessageRepository } = await import(
  "../../../infrastructure/repositories/MessageRepository.js"
);

describe("MessageRepository.getThread", () => {
  it("без участника не читает ничего", async () => {
    await expect(MessageRepository.getThread("77")).rejects.toThrow(/participantId/);
  });

  it("кладёт отправителя и получателя в тот же where, что и нить", async () => {
    capturedWhere.length = 0;
    await MessageRepository.getThread("77", 42n);

    const where = capturedWhere[0];
    const plain = (value) =>
      JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? String(item) : item));

    expect(where.OR).toEqual([{ id: 77n }, { thread_id: 77n }]);
    expect(plain(where.AND)).toContain("sender_id");
    expect(plain(where.AND)).toContain("receiver_id");
    expect(plain(where.AND)).toContain("42");
  });
});

describe("MessageController.getThread", () => {
  const buildController = async (messages) => {
    const { MessageController } = await import(
      "../../../presentation/controllers/MessageController.js"
    );
    const repository = { getThread: jest.fn(async () => messages) };
    return { controller: new MessageController(undefined, undefined, undefined, repository), repository };
  };

  const call = async (controller, { userId, threadId }) => {
    const req = { params: { threadId }, user: { user_id: userId } };
    const res = { json: jest.fn() };
    const next = jest.fn();
    await controller.getThread(req, res, next);
    return { res, next };
  };

  it("просит нить от имени вошедшего, а не просто по номеру", async () => {
    const { controller, repository } = await buildController([
      { toJSON: () => ({ id: "1" }) },
    ]);

    const { res } = await call(controller, { userId: 42n, threadId: "77" });

    expect(repository.getThread).toHaveBeenCalledWith("77", 42n);
    expect(res.json).toHaveBeenCalledWith({ messages: [{ id: "1" }] });
  });

  it("чужая нить — 404, а не пустой список: так её не отличить от несуществующей", async () => {
    const { controller } = await buildController([]);

    // `asyncHandler` не пробрасывает промис наружу: ошибка уходит в `next`.
    const req = { params: { threadId: "77" }, user: { user_id: 42n } };
    const res = { json: jest.fn() };
    const next = jest.fn();
    await controller.getThread(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(404);
    expect(error.message).toMatch(/not found/i);
  });
});
