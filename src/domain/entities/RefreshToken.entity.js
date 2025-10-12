/**
 * RefreshToken Entity
 * Represents a user session with refresh token
 */
export class RefreshToken {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.token = data.token;
    this.jti = data.jti; // JWT ID from token payload
    this.device_info = data.device_info || {};
    this.device_fingerprint = data.device_fingerprint;
    this.ip_address = data.ip_address;
    this.user_agent = data.user_agent;
    this.expires_at = data.expires_at;
    this.created_at = data.created_at;
    this.last_used_at = data.last_used_at;
    this.is_revoked = data.is_revoked || false;
    this.revoked_at = data.revoked_at;
  }

  /**
   * Check if token is expired
   */
  isExpired() {
    return new Date() > new Date(this.expires_at);
  }

  /**
   * Check if token is revoked
   */
  isRevoked() {
    return this.is_revoked === true;
  }

  /**
   * Check if token is valid (not expired and not revoked)
   */
  isValid() {
    return !this.isExpired() && !this.isRevoked();
  }

  /**
   * Get device description for display
   */
  getDeviceDescription() {
    const ua = this.user_agent || "";

    // Simple device detection
    let device = "Unknown Device";
    let os = "Unknown OS";
    let browser = "Unknown Browser";

    // OS detection
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS X")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iOS") || ua.includes("iPhone")) os = "iOS";

    // Browser detection
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome"))
      browser = "Safari";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";

    // Device type
    if (
      ua.includes("Mobile") ||
      ua.includes("Android") ||
      ua.includes("iPhone")
    ) {
      device = "Mobile";
    } else if (ua.includes("Tablet") || ua.includes("iPad")) {
      device = "Tablet";
    } else {
      device = "Desktop";
    }

    return `${device} • ${os} • ${browser}`;
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      id: this.id,
      device_description: this.getDeviceDescription(),
      ip_address: this.ip_address,
      last_used_at: this.last_used_at,
      created_at: this.created_at,
      expires_at: this.expires_at,
      is_revoked: this.is_revoked,
      is_current: false, // Will be set by service
    };
  }

  /**
   * Create from database row
   */
  static fromDatabase(row) {
    if (!row) return null;

    return new RefreshToken({
      id: row.id ? String(row.id) : undefined,
      user_id: row.user_id ? String(row.user_id) : undefined,
      token: row.token,
      jti: row.jti,
      device_info:
        typeof row.device_info === "string"
          ? JSON.parse(row.device_info)
          : row.device_info || {},
      device_fingerprint: row.device_fingerprint,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      expires_at: row.expires_at,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      is_revoked: row.is_revoked,
      revoked_at: row.revoked_at,
    });
  }
}
