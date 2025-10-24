import { USER_STATUS, USER_ROLES } from "../../core/constants/index.js";

/**
 * User Entity - represents a user in the system
 */
export class UserEntity {
  constructor(data) {
    this.user_id = data.user_id;
    this.username = data.username || null;
    this.first_name = data.first_name;
    this.last_name = data.last_name || null;
    this.avatar = data.avatar || null;
    this.telegram_first_name = data.telegram_first_name || null;
    this.telegram_last_name = data.telegram_last_name || null;
    this.is_manually_updated = data.is_manually_updated || false;
    this.status = data.status || USER_ROLES.ACTIVE;
    this.refresh_token = data.refresh_token || null;
    // Используем реальные даты из базы данных, не перезаписываем их
    this.joined_at = data.joined_at;
    this.created_at = data.joined_at; // Для совместимости
    this.updated_at = data.updated_at;

    // Временное логирование для отладки
    if (data.user_id === "245946670") {
      console.log("UserEntity constructor debug:", {
        user_id: data.user_id,
        joined_at_from_db: data.joined_at,
        updated_at_from_db: data.updated_at,
        joined_at_final: this.joined_at,
        created_at_final: this.created_at,
        updated_at_final: this.updated_at,
      });
    }
  }

  /**
   * Check if user is active
   */
  isActive() {
    return this.status === USER_ROLES.ACTIVE;
  }

  /**
   * Check if user is banned
   */
  isBanned() {
    return this.status === USER_STATUS.BANNED;
  }

  /**
   * Get display name
   */
  getDisplayName() {
    return this.username || this.first_name || `User ${this.user_id}`;
  }

  /**
   * Get full name
   */
  getFullName() {
    return [this.first_name, this.last_name].filter(Boolean).join(" ");
  }

  /**
   * Update user data
   */
  update(data) {
    const allowedFields = [
      "username",
      "first_name",
      "last_name",
      "avatar",
      "telegram_first_name",
      "telegram_last_name",
      "is_manually_updated",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    });

    this.updated_at = new Date();
  }

  /**
   * Set refresh token
   */
  setRefreshToken(token) {
    this.refresh_token = token;
  }

  /**
   * Clear refresh token
   */
  clearRefreshToken() {
    this.refresh_token = null;
  }

  /**
   * Convert to plain object (excluding sensitive data)
   */
  toJSON() {
    return {
      user_id: this.user_id,
      username: this.username,
      first_name: this.first_name,
      last_name: this.last_name,
      avatar: this.avatar,
      telegram_first_name: this.telegram_first_name,
      telegram_last_name: this.telegram_last_name,
      is_manually_updated: this.is_manually_updated,
      status: this.status,
      joined_at: this.joined_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Convert to safe object for public display (even more limited)
   */
  toPublicJSON() {
    return {
      user_id: this.user_id,
      username: this.username,
      first_name: this.first_name,
      last_name: this.last_name,
      avatar: this.avatar,
    };
  }
}
