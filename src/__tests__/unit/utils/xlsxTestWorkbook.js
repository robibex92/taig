/**
 * Сборка минимального .xlsx в памяти для тестов читалки.
 *
 * Собираем настоящий ZIP (deflate или store) и те же XML, что приносит ГИС
 * ЖКХ, потому что тест должен падать, если сломается обход каталога архива или
 * распаковка, а не только разбор тегов.
 */

import zlib from "node:zlib";

const CRC_POLYNOMIAL = 0xedb88320;

const crcTable = (() => {
  const table = new Int32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? CRC_POLYNOMIAL ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value;
  }

  return table;
})();

const crc32 = (buffer) => {
  let value = -1;

  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ -1) >>> 0;
};

const buildZip = (files) => {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const deflate = file.deflate !== false;
    const payload = deflate ? zlib.deflateRawSync(content) : content;
    const method = deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc32(content), 16);
    entry.writeUInt32LE(payload.length, 20);
    entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);

    locals.push(local, name, payload);
    central.push(entry, name);
    offset += local.length + name.length + payload.length;
  }

  const centralDirectory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDirectory, end]);
};

const escapeXml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Общий словарь строк: повтор значения получает тот же `<si>` и тот же индекс. */
const createStringTable = () => {
  const items = [];
  const index = new Map();

  const intern = (key, item) => {
    if (index.has(key)) return index.get(key);

    items.push(item);
    index.set(key, items.length - 1);

    return items.length - 1;
  };

  return {
    indexOf: (text) => intern(`s:${text}`, { text }),
    /** Rich-текст: ГИС разбивает значение на фрагменты, их склеивает читалка. */
    indexOfRuns: (runs) => intern(`r:${runs.join("\u0000")}`, { runs }),
    items,
  };
};

/** Значение ячейки: число, строка или `{ runs: ["оф.", " 1"] }` для rich-текста. */
const isRich = (value) => value !== null && typeof value === "object" && Array.isArray(value.runs);

const sheetXml = (rows, strings) => {
  const body = rows.map(({ r, cells }) => {
    const written = Object.entries(cells ?? {})
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([reference, value]) => {
        if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;

        const index = isRich(value) ? strings.indexOfRuns(value.runs) : strings.indexOf(value);

        return `<c r="${reference}" t="s"><v>${index}</v></c>`;
      })
      .join("");

    return `<row r="${r}">${written}</row>`;
  });

  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body.join(
    ""
  )}</sheetData></worksheet>`;
};

const inlineSheetXml = (rows) => {
  const body = rows.map(({ r, cells }) => {
    const written = Object.entries(cells ?? {})
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([reference, value]) =>
        typeof value === "number"
          ? `<c r="${reference}"><v>${value}</v></c>`
          : `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
      )
      .join("");

    return `<row r="${r}">${written}</row>`;
  });

  return `<worksheet><sheetData>${body.join("")}</sheetData></worksheet>`;
};

const siXml = (item) =>
  item.runs
    ? `<si>${item.runs.map((run) => `<r><t>${escapeXml(run)}</t></r>`).join("")}</si>`
    : `<si><t>${escapeXml(item.text)}</t></si>`;

const workbookXml = (names) =>
  `<workbook><sheets>${names
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("")}</sheets></workbook>`;

const relsXml = (count) =>
  `<Relationships>${Array.from({ length: count }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("")}</Relationships>`;

/**
 * @param {Array<{ name: string, rows: Array<{ r: number, cells: object }> }>} sheets
 * @param {{ deflate?: boolean }} options — `deflate: false` пишет элементы без сжатия
 */
export const buildWorkbook = (sheets, { deflate = true } = {}) => {
  const strings = createStringTable();
  const documents = sheets.map((sheet) => sheetXml(sheet.rows, strings));

  const files = [
    { name: "xl/workbook.xml", content: workbookXml(sheets.map((sheet) => sheet.name)) },
    { name: "xl/_rels/workbook.xml.rels", content: relsXml(sheets.length) },
    { name: "xl/sharedStrings.xml", content: `<sst>${strings.items.map(siXml).join("")}</sst>` },
    ...documents.map((content, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content,
    })),
  ];

  if (deflate === false) {
    for (const file of files) file.deflate = false;
  }

  return buildZip(files);
};

/** Лист с inline-строками вместо общего словаря — второй способ принести текст. */
export const buildInlineWorkbook = (rows) =>
  buildZip([
    { name: "xl/workbook.xml", content: workbookXml(["Лист1"]) },
    { name: "xl/_rels/workbook.xml.rels", content: relsXml(1) },
    { name: "xl/worksheets/sheet1.xml", content: inlineSheetXml(rows) },
  ]);

export { escapeXml };
