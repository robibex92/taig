/* eslint-env jest */
import { describe, expect, it } from "@jest/globals";
import { readWorkbook } from "../../../core/utils/xlsxWorkbook.js";
import { buildInlineWorkbook, buildWorkbook } from "./xlsxTestWorkbook.js";

const GIS_SHEET = "Статистика по голосованию";

const workbookOf = (rows, options) =>
  buildWorkbook([{ name: GIS_SHEET, rows }], options);

const sheetOf = (rows, options) => readWorkbook(workbookOf(rows, options)).readSheet(GIS_SHEET);

describe("читалка .xlsx без зависимостей", () => {
  it("возвращает имена листов в порядке книги", () => {
    const workbook = readWorkbook(
      buildWorkbook([
        { name: GIS_SHEET, rows: [{ r: 1, cells: { A1: "а" } }] },
        { name: "Инструкция", rows: [{ r: 1, cells: { A1: "б" } }] },
      ])
    );

    expect(workbook.sheetNames).toEqual([GIS_SHEET, "Инструкция"]);
  });

  it("читает строки из общего словаря и числа как текст ячейки", () => {
    const rows = sheetOf([
      { r: 13, cells: { A13: "№ помещения", B13: "Площадь" } },
      { r: 14, cells: { A14: "103", B14: 23.6, J14: "54:35:041122:1161" } },
    ]);

    expect(rows.get(14).get(1)).toBe("103");
    // число 23.6 в файле ГИС — текст ячейки без признака типа
    expect(rows.get(14).get(2)).toBe("23.6");
    expect(rows.get(14).get(10)).toBe("54:35:041122:1161");
  });

  it("пропускает пустые ячейки и строки без значений", () => {
    const rows = sheetOf([
      { r: 5, cells: {} },
      { r: 14, cells: { A14: "1", B14: "", D14: "Собственность" } },
    ]);

    expect(rows.has(5)).toBe(false);
    expect([...rows.get(14).keys()]).toEqual([1, 4]);
  });

  it("понимает inline-строки вместо общего словаря", () => {
    const rows = readWorkbook(
      buildInlineWorkbook([{ r: 14, cells: { A14: "Оф. 1", J14: "54:35:041122:1672" } }])
    ).readSheet("Лист1");

    expect(rows.get(14).get(1)).toBe("Оф. 1");
    expect(rows.get(14).get(10)).toBe("54:35:041122:1672");
  });

  it("склеивает rich-текст из нескольких фрагментов одного значения", () => {
    const rows = sheetOf([
      { r: 14, cells: { A14: { runs: ["Оф", "ф. ", "1"] }, B14: "площадь" } },
    ]);

    expect(rows.get(14).get(1)).toBe("Офф. 1");
  });

  it("читает элементы архива без сжатия", () => {
    const rows = sheetOf([{ r: 14, cells: { A14: "кладовая 12К" } }], { deflate: false });

    expect(rows.get(14).get(1)).toBe("кладовая 12К");
  });

  it("декодирует XML-сущности в тексте", () => {
    const rows = sheetOf([{ r: 5, cells: { C5: 'ООО "УК «Тайгинский» & Co"' } }]);

    expect(rows.get(5).get(3)).toBe('ООО "УК «Тайгинский» & Co"');
  });

  it("не читает чужой файл как .xlsx", () => {
    expect(() => readWorkbook(Buffer.from("это не архив, а текст"))).toThrow(
      /не читается как \.xlsx/
    );
    expect(() => readWorkbook(Buffer.alloc(0))).toThrow(/пустой или обрезан/);
  });

  it("сообщает о листе, которого в файле нет", () => {
    const workbook = readWorkbook(workbookOf([{ r: 14, cells: { A14: "1" } }]));

    expect(workbook.hasSheet("Инструкция")).toBe(false);
    expect(() => workbook.readSheet("Инструкция")).toThrow(/нет листа «Инструкция»/);
  });
});
