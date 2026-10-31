/* eslint-env jest */
/**
 * Ручная отправка сообщения в выбранные MAX-чаты из админки.
 *
 * Главное, что тут проверяется: адрес сообщения берётся только из реестра
 * `max_chats`. В запросе едут id строк реестра, и даже если кто-то подставит в
 * них чужой `chat_id`, до MAX уйдёт тот, что лежит в базе. Второе: чат, которого
 * в активном реестре нет, возвращается оператору пропущенным, а не исчезает молча.
 */

import { jest } from "@jest/globals";
import { SendMaxBotChatMessageUseCase } from "../../../application/use-cases/maxBot/SendMaxBotChatMessageUseCase.js";
import { ValidationError } from "../../../core/errors/AppError.js";
import { MAX_BOT_TEXT_LIMIT } from "../../../core/constants/maxBot.js";

const logger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

const chat = (id, chatId, { purpose = "ads", name = `Чат ${id}` } = {}) => ({
  id: BigInt(id),
  chat_id: BigInt(chatId),
  name,
  purpose,
  is_active: true,
});

const build = ({ active = [], send = jest.fn(async () => ({ ok: true, message_id: "9" })) } = {}) => {
  const chats = { getActiveChats: jest.fn(async () => active) };
  const service = { isConfigured: jest.fn(() => true), sendChatMessage: send };
  const log = logger();
  const useCase = new SendMaxBotChatMessageUseCase({
    chatRepository: chats,
    service,
    loggerImpl: log,
  });

  return { chats, service, send, log, useCase };
};

describe("отправка сообщения в MAX-чаты", () => {
  it("отправляет по chat_id из реестра, а не из запроса", async () => {
    const { useCase, send } = build({ active: [chat(7, 500100)] });

    const result = await useCase.send({ text: "Плановое отключение воды", maxChatIds: [7] });

    expect(send).toHaveBeenCalledWith("500100", "Плановое отключение воды");
    expect(result).toMatchObject({ total: 1, sent: 1, failed: 0, skipped: 0 });
    expect(result.items[0]).toMatchObject({
      max_chat_id: "7",
      name: "Чат 7",
      purpose: "ads",
      status: "sent",
    });
  });

  it("выключенный или удалённый чат возвращается пропущенным, а не исчезает молча", async () => {
    const { useCase, send, log } = build({ active: [chat(7, 500100)] });

    const result = await useCase.send({ text: "Тест", maxChatIds: [7, 999] });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 2, sent: 1, skipped: 1 });
    expect(result.items).toContainEqual({
      max_chat_id: "999",
      name: null,
      purpose: null,
      status: "skipped",
      error: expect.stringContaining("не найден в активном реестре"),
    });
    expect(log.warn).toHaveBeenCalled();
  });

  it("одна неудача не отменяет остальные чаты и не превращает ответ в 500", async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, skipped: false, error: "Бот выведен из чата", code: "forbidden" })
      .mockRejectedValueOnce(new Error("MAX API: timeout"))
      .mockResolvedValueOnce({ ok: true, message_id: "12" });

    const { useCase, log } = build({
      active: [chat(1, 111), chat(2, 222), chat(3, 333)],
      send,
    });

    const result = await useCase.send({ text: "Тест", maxChatIds: [1, 2, 3] });

    expect(result).toMatchObject({ total: 3, sent: 1, failed: 2 });
    expect(result.items[0]).toMatchObject({ status: "failed", error: "Бот выведен из чата" });
    expect(result.items[1]).toMatchObject({ status: "failed", error: "MAX API: timeout" });
    expect(log.error).toHaveBeenCalledTimes(2);
  });

  it("служебный ответ MAX без диалога считается пропущенным, а не ошибкой", async () => {
    const { useCase } = build({
      active: [chat(1, 111)],
      send: jest.fn(async () => ({ ok: false, skipped: true, error: "Нет диалога", code: "dialog.not.found" })),
    });

    const result = await useCase.send({ text: "Тест", maxChatIds: [1] });

    expect(result).toMatchObject({ total: 1, sent: 0, failed: 0, skipped: 1 });
  });

  it("не настроенный бот — ошибка до единого запроса в MAX", async () => {
    const { useCase, send } = build({ active: [chat(1, 111)] });
    useCase.service.isConfigured.mockReturnValue(false);

    await expect(useCase.send({ text: "Тест", maxChatIds: [1] })).rejects.toThrow(ValidationError);
    expect(send).not.toHaveBeenCalled();
  });

  it("пустой список чатов, пустой и слишком длинный текст — валидация, а не отправка", async () => {
    const { useCase, send } = build({ active: [chat(1, 111)] });

    await expect(useCase.send({ text: "Тест", maxChatIds: [] })).rejects.toThrow("Не выбран ни один чат");
    await expect(useCase.send({ text: "   ", maxChatIds: [1] })).rejects.toThrow(ValidationError);
    await expect(
      useCase.send({ text: "a".repeat(MAX_BOT_TEXT_LIMIT + 1), maxChatIds: [1] })
    ).rejects.toThrow(ValidationError);
    expect(send).not.toHaveBeenCalled();
  });

  it("нечисловой id и слишком много чатов в одной отправке отсекаются на входе", async () => {
    const { useCase, send } = build({ active: [chat(1, 111)] });

    await expect(useCase.send({ text: "Тест", maxChatIds: ["abc"] })).rejects.toThrow(
      "Некорректный id чата"
    );
    await expect(
      useCase.send({ text: "Тест", maxChatIds: Array.from({ length: 51 }, (_, i) => i + 1) })
    ).rejects.toThrow("максимум 50");
    expect(send).not.toHaveBeenCalled();
  });

  it("дубли выбора схлопываются в одну отправку", async () => {
    const { useCase, send } = build({ active: [chat(1, 111)] });

    const result = await useCase.send({ text: "Тест", maxChatIds: [1, 1, "1"] });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 1, sent: 1 });
  });
});
