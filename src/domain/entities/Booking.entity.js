/**
 * Booking Entity
 * Represents a booking/reservation for an ad
 */
class Booking {
  constructor({
    id,
    ad_id,
    user_id,
    status = "pending",
    priority = 0,
    message = null,
    seller_note = null,
    created_at,
    updated_at,
    // Relations
    ad = null,
    user = null,
  }) {
    this.id = id;
    this.ad_id = ad_id;
    this.user_id = user_id;
    this.status = status; // pending, confirmed, rejected, cancelled
    this.priority = priority; // For queue ordering (lower = higher priority)
    this.message = message; // Buyer's message
    this.seller_note = seller_note; // Seller's notes
    this.created_at = created_at;
    this.updated_at = updated_at;
    // Relations
    this.ad = ad;
    this.user = user;
  }

  /**
   * Check if booking is active (pending or confirmed)
   */
  isActive() {
    return ["pending", "confirmed"].includes(this.status);
  }

  /**
   * Check if booking can be confirmed
   */
  canBeConfirmed() {
    return this.status === "pending";
  }

  /**
   * Check if booking can be cancelled
   */
  canBeCancelled() {
    return ["pending", "confirmed"].includes(this.status);
  }

  /**
   * Validate booking data
   */
  static validate(data) {
    const errors = [];

    if (!data.ad_id) {
      errors.push("ad_id is required");
    }

    if (!data.user_id) {
      errors.push("user_id is required");
    }

    if (
      data.status &&
      !["pending", "confirmed", "rejected", "cancelled"].includes(data.status)
    ) {
      errors.push("Invalid status value");
    }

    if (data.message && data.message.length > 500) {
      errors.push("Message must be less than 500 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = Booking;
