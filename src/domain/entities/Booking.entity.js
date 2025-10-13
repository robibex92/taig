/**
 * Booking Entity - represents a booking for an ad
 */
export class BookingEntity {
  constructor(data) {
    this.id = data.id;
    this.ad_id = data.ad_id;
    this.user_id = data.user_id;
    this.booking_order = data.booking_order;
    this.status = data.status || "active";
    this.created_at = data.created_at || new Date();
    this.cancelled_at = data.cancelled_at || null;

    // Related entities (опционально)
    this.ad = data.ad || null;
    this.user = data.user || null;
  }

  /**
   * Cancel booking
   */
  cancel() {
    this.status = "cancelled";
    this.cancelled_at = new Date();
  }

  /**
   * Check if booking is active
   */
  isActive() {
    return this.status === "active";
  }

  /**
   * Check if booking is cancelled
   */
  isCancelled() {
    return this.status === "cancelled";
  }

  /**
   * Get order text
   */
  getOrderText() {
    const texts = {
      1: "первым",
      2: "вторым",
      3: "третьим",
      4: "четвертым",
      5: "пятым",
    };
    return texts[this.booking_order] || `${this.booking_order}-м`;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id?.toString(),
      ad_id: this.ad_id?.toString(),
      user_id: this.user_id?.toString(),
      booking_order: this.booking_order,
      status: this.status,
      created_at: this.created_at,
      cancelled_at: this.cancelled_at,
      ad: this.ad,
      user: this.user,
      order_text: this.getOrderText(),
    };
  }

  /**
   * Create from database
   */
  static fromDatabase(data) {
    return new BookingEntity(data);
  }
}
