/**
 * FAQ Entity
 * Represents a frequently asked question
 */
export class Faq {
  constructor({ id, question, answer, status, created_at, updated_at }) {
    this.id = id;
    this.question = question;
    this.answer = answer;
    this.status = status;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  /**
   * Create FAQ from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new Faq({
      id: row.id,
      question: row.question,
      answer: row.answer,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      question: this.question,
      answer: this.answer,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
