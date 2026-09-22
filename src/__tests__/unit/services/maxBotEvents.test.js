/* eslint-env jest */
/**
 * Юнит-тесты парсера событий MAX Bot API.
 *
 * MAX отдаёт `message_created` то с плоским телом, то с вложенным
 * `message.data.text` / `hints.user` / `message.repliers` — проверяем, что
 * нормализация одинакова для всех форм, и что собственные сообщения бота
 * в журнал не попадают.
 */

import {
  parseMaxUpdate,
  parseMaxUpdatesPayload,
  extractUpdateList,
  extractPayloadMarker,
} from "../../../core/utils/maxBotEvents.js";

describe("maxBotEvents — parseMaxUpdate", () => {
  it("читает плоское сообщение (text и user_id на одном уровне)", () => {
    const parsed = parseMaxUpdate({
      update_type: "message_created",
      marker: 101,
      message: {
        user_id: 5001,
        first_name: "Иван",
        username: "ivan",
        text: "Где парковка для 39 дома?",
      },
    });

    expect(parsed).toEqual({
      max_user_id: "5001",
      text: "Где парковка для 39 дома?",
      display_name: "Иван",
      username: "ivan",
      marker: "101",
      update_type: "message_created",
    });
  });

  it("распаковывает вложенный message.data.text + hints.user", () => {
    const parsed = parseMaxUpdate({
      update_type: "message_created",
      update_id: "202",
      message: {
        data: { text: "  Записалась во двор  " },
        hints: { user: { user_id: "77", name: "Мария", username: "maria77" } },
      },
    });

    expect(parsed.max_user_id).toBe("77");
    expect(parsed.text).toBe("Записалась во двор");
    expect(parsed.display_name).toBe("Мария");
    expect(parsed.marker).toBe("202");
  });

  it("берёт автора из message.repliers, если он только там", () => {
    const parsed = parseMaxUpdate({
      type: "message_created",
      message: {
        text: "Спасибо!",
        repliers: [{ id: "900", first_name: "Пётр" }],
      },
    });

    expect(parsed.max_user_id).toBe("900");
    expect(parsed.display_name).toBe("Пётр");
  });

  it("не принимает id события за id автора", () => {
    const parsed = parseMaxUpdate({
      update_type: "message_created",
      id: 55,
      message: { text: "Привет" },
    });

    expect(parsed).toBeNull();
  });

  it("игнорирует сообщения самого бота (is_bot)", () => {
    expect(
      parseMaxUpdate({
        update_type: "message_created",
        message: { user_id: 1, is_bot: true, text: "рассылка" },
      })
    ).toBeNull();
  });

  it("игнорирует сообщения бота, переданного по botUserId", () => {
    expect(
      parseMaxUpdate(
        { update_type: "message_created", message: { user_id: 4242, text: "рассылка" } },
        { botUserId: "4242" }
      )
    ).toBeNull();
  });

  it("пропускает не-события message_created и пустой текст", () => {
    expect(
      parseMaxUpdate({ update_type: "bot_started", message: { user_id: 5, text: "x" } })
    ).toBeNull();
    expect(
      parseMaxUpdate({ update_type: "message_created", message: { user_id: 5, text: "   " } })
    ).toBeNull();
    expect(parseMaxUpdate(null)).toBeNull();
  });
});

describe("maxBotEvents — ответ GET /updates целиком", () => {
  const payload = {
    updates: [
      {
        update_type: "message_created",
        marker: 10,
        message: { user_id: 11, first_name: "Анна", text: "Здравствуйте" },
      },
      {
        update_type: "message_created",
        marker: 11,
        message: { user_id: 12, data: { text: "Когда вывоз мусора?" } },
      },
      {
        // дубль предыдущего события — MAX иногда перевыставляет курсор
        update_type: "message_created",
        marker: 11,
        message: { user_id: 12, data: { text: "Когда вывоз мусора?" } },
      },
      { update_type: "bot_started", marker: 12, user: { user_id: 13 } },
    ],
    marker: 12,
  };

  it("возвращает только входящие сообщения людей", () => {
    const incoming = parseMaxUpdatesPayload(payload);

    expect(incoming).toHaveLength(2);
    expect(incoming.map((item) => item.max_user_id)).toEqual(["11", "12"]);
  });

  it("extractUpdateList понимает обёртку, массив и одиночное событие", () => {
    expect(extractUpdateList(payload)).toHaveLength(4);
    expect(extractUpdateList({ events: [{ update_type: "message_created" }] })).toHaveLength(1);
    expect(extractUpdateList([{ update_type: "message_created" }])).toHaveLength(1);
    expect(extractUpdateList({ update_type: "message_created", message: { text: "a" } })).toHaveLength(
      1
    );
    expect(extractUpdateList("мусор")).toHaveLength(0);
  });

  it("extractPayloadMarker берёт наибольший курсор (event > payload)", () => {
    expect(extractPayloadMarker(payload)).toBe("12");
    expect(
      extractPayloadMarker({
        updates: [{ update_type: "message_created", marker: 99, message: { user_id: 1, text: "x" } }],
        marker: 50,
      })
    ).toBe("99");
    expect(extractPayloadMarker({ updates: [] })).toBeNull();
  });
});
