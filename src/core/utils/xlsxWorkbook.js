/**
 * Читалка `.xlsx` без единой внешней зависимости.
 *
 * XLSX — это ZIP с двумя XML внутри (`xl/sharedStrings.xml` и
 * `xl/worksheets/sheetN.xml`), а выгрузка ГИС ЖКХ весит ~41 КБ. SheetJS ради
 * одного листа был бы зависимостью и в проде, и в тестовом бэкенде, поэтому
 * здесь только обход центрального каталога ZIP, `inflateRawSync` на элемент и
 * скан нужных тегов. Файл формирует ГИС, а не человек: вложенности одинаковых
 * тегов и переносов `>` внутри атрибутов у него нет, и на этом упрощение
 * держится — поэтому оно названо явно.
 */

import zlib from "node:zlib";
import { ValidationError } from "../errors/AppError.js";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_ENTRY_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;
/** Поле «длина комментария» в EOCD — 16 бит, дальше искать запись нет смысла. */
const MAX_EOCD_SEARCH = 0xffff + 22;

const broken = (message) => new ValidationError(message);

const findEndOfCentralDirectory = (buffer) => {
  const floor = Math.max(0, buffer.length - MAX_EOCD_SEARCH);

  for (let position = buffer.length - 22; position >= floor; position -= 1) {
    if (buffer.readUInt32LE(position) === EOCD_SIGNATURE) return position;
  }

  throw broken("Файл не читается как .xlsx: каталог содержимого не найден");
};

/** Имена элементов архива → как их распаковать. */
const listEntries = (buffer) => {
  const end = findEndOfCentralDirectory(buffer);
  const total = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = new Map();

  for (let index = 0; index < total; index += 1) {
    if (
      cursor + CENTRAL_ENTRY_SIZE > buffer.length ||
      buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE
    ) {
      throw broken("Файл не читается как .xlsx: каталог содержимого повреждён");
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + CENTRAL_ENTRY_SIZE, cursor + CENTRAL_ENTRY_SIZE + nameLength);

    entries.set(name, { method, compressedSize, localOffset });
    cursor += CENTRAL_ENTRY_SIZE + nameLength + extraLength + commentLength;
  }

  return entries;
};

const readEntry = (buffer, entry, name) => {
  const start = entry.localOffset;

  if (start + LOCAL_HEADER_SIZE > buffer.length || buffer.readUInt32LE(start) !== LOCAL_SIGNATURE) {
    throw broken(`Файл не читается как .xlsx: элемент «${name}» повреждён`);
  }

  const dataStart =
    start + LOCAL_HEADER_SIZE + buffer.readUInt16LE(start + 26) + buffer.readUInt16LE(start + 28);
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return raw;
  if (entry.method === 8) return zlib.inflateRawSync(raw);

  throw broken(`Файл не читается как .xlsx: неизвестное сжатие «${entry.method}»`);
};

/* ------------------------------------------------------------------ XML ---- */

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decodeEntities = (text) =>
  String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === "#") {
      const codePoint = Number.parseInt(body[1] === "x" ? body.slice(2) : body.slice(1), body[1] === "x" ? 16 : 10);

      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });

const ATTRIBUTE_PATTERN = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"/g;

const attributesOf = (header) => {
  const found = {};
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match;

  while ((match = ATTRIBUTE_PATTERN.exec(header)) !== null) {
    found[match[1]] = decodeEntities(match[2]);
  }

  return found;
};

/** Позиция следующего открытого тега именно `name` (не `name` + буквы). */
const findTagOpen = (xml, name, from) => {
  const opener = `<${name}`;
  let cursor = from;

  for (;;) {
    const index = xml.indexOf(opener, cursor);
    if (index === -1) return -1;

    const next = xml[index + opener.length];
    if (next === undefined || next === ">" || next === "/" || /\s/.test(next)) return index;
    cursor = index + opener.length;
  }
};

/**
 * Все элементы `<name …>inner</name>` плоским списком `{ attrs, inner }`.
 * Самозакрывающийся тег даёт inner = "".
 */
const collectElements = (xml, name) => {
  const found = [];
  let cursor = 0;

  for (;;) {
    const open = findTagOpen(xml, name, cursor);
    if (open === -1) break;

    const headerEnd = xml.indexOf(">", open);
    if (headerEnd === -1) break;

    const header = xml.slice(open + name.length + 1, headerEnd);
    const selfClosing = header.endsWith("/");
    const attrs = attributesOf(selfClosing ? header.slice(0, -1) : header);
    const closeTag = `</${name}>`;

    if (selfClosing) {
      found.push({ attrs, inner: "" });
      cursor = headerEnd + 1;
      continue;
    }

    const bodyStart = headerEnd + 1;
    const close = xml.indexOf(closeTag, bodyStart);
    found.push({ attrs, inner: close === -1 ? xml.slice(bodyStart) : xml.slice(bodyStart, close) });
    cursor = (close === -1 ? xml.length : close + closeTag.length);
  }

  return found;
};

const textOf = (xml) =>
  collectElements(xml, "t")
    .map((element) => decodeEntities(element.inner))
    .join("");

const sharedStringsFrom = (xml) => collectElements(xml, "si").map((si) => textOf(si.inner));

/* ----------------------------------------------------------------- cells --- */

/** «BC12» → номер колонки с единицы. */
const columnIndex = (reference) => {
  const letters = String(reference ?? "").replace(/[0-9]/g, "");
  let index = 0;

  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }

  return index;
};

const cellValue = (cell, sharedStrings) => {
  const values = collectElements(cell.inner, "v");
  const inline = collectElements(cell.inner, "is");

  if (inline.length > 0) return textOf(cell.inner);
  if (values.length === 0) return "";

  const raw = decodeEntities(values[0].inner);

  if (cell.attrs.t !== "s") return raw;
  return sharedStrings[Number(raw)] ?? "";
};

/**
 * Лист как `Map<номер строки, Map<номер колонки, текст ячейки>>`.
 * Номера — из атрибутов, пустые строки и ячейки в карту не попадают.
 */
const parseSheet = (xml, sharedStrings) => {
  const rows = new Map();

  for (const rowElement of collectElements(xml, "row")) {
    const cells = new Map();

    for (const cellElement of collectElements(rowElement.inner, "c")) {
      // Выгрузка ГИС всегда приносит адрес ячейки; без него колонку определить
      // нельзя, и молча сдвигать остальные ячейки было бы хуже, чем потерять одну.
      if (!cellElement.attrs.r) continue;

      const value = cellValue(cellElement, sharedStrings).trim();
      if (value !== "") cells.set(columnIndex(cellElement.attrs.r), value);
    }

    if (cells.size > 0) rows.set(Number(rowElement.attrs.r) || rows.size + 1, cells);
  }

  return rows;
};

/** Листы книги: имя → путь внутри архива (через `workbook.xml.rels`). */
const sheetTargets = (entries, read) => {
  const relationships = new Map();

  for (const rel of collectElements(read("xl/_rels/workbook.xml.rels"), "Relationship")) {
    relationships.set(rel.attrs.Id, rel.attrs.Target);
  }

  return collectElements(read("xl/workbook.xml"), "sheet").map((sheet) => {
    let target = (relationships.get(sheet.attrs["r:id"]) ?? "").replace(/^\.?\//, "");
    if (!target.startsWith("xl/")) target = `xl/${target}`;

    if (!entries.has(target)) {
      throw broken(`В файле нет содержимого листа «${sheet.attrs.name}»`);
    }

    return { name: sheet.attrs.name, path: target };
  });
};

/**
 * Открыть .xlsx. `readSheet(name)` бросает ValidationError, если листа нет, —
 * то есть чужой файл с тем же расширением отваливается до разбора строк.
 */
export const readWorkbook = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 30) {
    throw broken("Файл пустой или обрезан");
  }

  const entries = listEntries(buffer);
  const read = (name) => {
    const entry = entries.get(name);
    if (!entry) throw broken(`В файле нет «${name}»`);

    return readEntry(buffer, entry, name).toString("utf8");
  };

  const strings = entries.has("xl/sharedStrings.xml") ? sharedStringsFrom(read("xl/sharedStrings.xml")) : [];
  const sheets = sheetTargets(entries, read);

  if (sheets.length === 0) throw broken("В файле нет ни одного листа");

  const byName = new Map(sheets.map((sheet) => [sheet.name, sheet.path]));

  return {
    sheetNames: sheets.map((sheet) => sheet.name),
    hasSheet: (name) => byName.has(name),
    readSheet(name) {
      const path = byName.get(name);
      if (!path) throw broken(`В файле нет листа «${name}»`);

      return parseSheet(read(path), strings);
    },
  };
};
