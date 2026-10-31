/* eslint-env jest */
/**
 * Правила подбора автоответа: регистр, ё/е, границы слов и быстрый отсев по
 * первому символу фразы.
 *
 * Отсев добавлен позже совпадений и может их сломать молча: он сравнивает
 * первую букву уже нормализованной фразы с нормализованным текстом, поэтому
 * «ёлки» и «ЕЛКИ» обязаны остаться одним и тем же сочетанием.
 */

import {
  matchAutoReply,
  normalizeTriggerText,
  triggerMatches,
} from "../../../core/utils/chatAutoReply.js";

const condition = (id, phrase, response) => ({ id: BigInt(id), phrase, response });

describe("triggerMatches", () => {
  it("не различает регистра, ё/е и числа пробелов", () => {
    expect(triggerMatches("Телефон  УК", "подскажите ТЕЛЕФОН ук?")).toBe(true);
    expect(triggerMatches("телефон ук", "Телефон\tУК")).toBe(true);
  });

  it("требует границ слов: «телефон ук» не ловит «телефон укзамена»", () => {
    expect(triggerMatches("телефон ук", "телефон укзамена нет")).toBe(false);
    expect(triggerMatches("телефон ук", "телефон ук?!")).toBe(true);
  });

  it("первая буква фразы с ё совпадает и с написанием через е", () => {
    expect(triggerMatches("ёлки", "Во дворе ЕЛКИ сломали")).toBe(true);
    expect(triggerMatches("елки", "Во дворе ёлки сломали")).toBe(true);
  });

  it("пустая фраза и пустой текст не матчатся", () => {
    expect(triggerMatches("  ", "что-то написали")).toBe(false);
    expect(triggerMatches("телефон ук", "   ")).toBe(false);
  });
});

describe("matchAutoReply", () => {
  const conditions = [
    condition(1, "телефон ук", "+7 383 233-02-03"),
    condition(2, "авария газа", "Вызовите 104 и сообщите диспетчеру"),
    condition(3, "ёлки", "Ёлки в этом году ставим у 39 подъезда"),
  ];

  it("возвращает первое по порядку условие вместе с его ответом", () => {
    const matched = matchAutoReply(conditions, "Привет! Где телефон УК и вообще авария газа?");

    expect(matched?.response).toBe("+7 383 233-02-03");
  });

  it("отсев по первой букве не теряет ни одного совпадения", () => {
    expect(matchAutoReply(conditions, "срочно! АВАРИЯ ГАЗА во дворе")?.response).toBe(
      "Вызовите 104 и сообщите диспетчеру"
    );
    expect(matchAutoReply(conditions, "когда уже ЕЛКИ будут?")?.response).toBe(
      "Ёлки в этом году ставим у 39 подъезда"
    );
  });

  it("текст без единого подходящего условия — null, а не исключение", () => {
    expect(matchAutoReply(conditions, "кто-нибудь, верните котика")).toBeNull();
    expect(matchAutoReply(null, "телефон ук")).toBeNull();
    expect(matchAutoReply(conditions, "")).toBeNull();
  });

  it("нормализация фразы не зависит от того, как её завели", () => {
    expect(normalizeTriggerText("  Телефон   УК ")).toBe("телефон ук");
    expect(matchAutoReply([condition(1, "Телефон   УК", "ок")], "нужен телефон ук")).not.toBeNull();
  });
});
