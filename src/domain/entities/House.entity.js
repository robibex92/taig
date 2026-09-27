/**
 * House Entity
 * Represents an apartment/flat in a building
 */
export class House {
  constructor({
    id,
    house,
    entrance,
    number,
    floor,
    facade_color,
    info,
    position,
    cell_index,
    cell_span,
    status,
    created_at,
    id_telegram,
  }) {
    this.id = id;
    this.house = house;
    this.entrance = entrance;
    this.number = number;
    this.floor = floor;
    this.facade_color = facade_color;
    this.info = info;
    this.position = position;
    this.cell_index = cell_index;
    this.cell_span = cell_span;
    this.status = status;
    this.created_at = created_at;
    this.id_telegram = id_telegram;
  }

  /**
   * Ширина ячейки в сетке витрины: null в БД означает «одна ячейка».
   * Дробная часть отбрасывается — тот же принцип на фронте (`apartmentSpan`).
   */
  get cellSpan() {
    const span = Math.floor(Number(this.cell_span));

    return Number.isFinite(span) && span > 1 ? span : 1;
  }

  /**
   * Колонка в ряду этажа (0 — первая). null = «расставить автоматически»,
   * поэтому отдельно от `position` (индекс совладельца) и от `floor_rules.position`
   * (сдвиг всего ряда).
   */
  get cellIndex() {
    if (this.cell_index === null || this.cell_index === undefined) return null;

    const index = Math.floor(Number(this.cell_index));

    return Number.isFinite(index) && index >= 0 ? index : null;
  }

  /**
   * Create entity from database row
   */
  static fromDatabase(row) {
    return new House({
      id: row.id ? Number(row.id) : null,
      house: row.house,
      entrance: row.entrance,
      number: row.number,
      floor: row.floor,
      facade_color: row.facade_color,
      info: row.info,
      position: row.position,
      cell_index: row.cell_index,
      cell_span: row.cell_span,
      status: row.status,
      created_at: row.created_at,
      id_telegram: row.id_telegram,
    });
  }

  /**
   * Convert to plain object (for API response)
   */
  toJSON() {
    return {
      id: this.id,
      house: this.house,
      entrance: this.entrance,
      number: this.number,
      floor: this.floor,
      facade_color: this.facade_color,
      info: this.info,
      position: this.position,
      cell_index: this.cellIndex,
      cell_span: this.cellSpan,
      status: this.status,
      created_at: this.created_at,
      id_telegram: this.id_telegram,
    };
  }

  /**
   * Convert to filtered JSON (exclude internal fields, add hasInfo)
   */
  toFilteredJSON() {
    return {
      id: this.id,
      number: this.number,
      floor: this.floor,
      facade_color: this.facade_color,
      position: this.position,
      cell_index: this.cellIndex,
      cell_span: this.cellSpan,
      id_telegram: this.id_telegram,
      hasInfo: !!(this.info && this.info.trim()),
    };
  }
}
