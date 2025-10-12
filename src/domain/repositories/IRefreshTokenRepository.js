/**
 * Refresh Token Repository Interface
 * Handles storage and retrieval of refresh tokens (sessions)
 */
export class IRefreshTokenRepository {
  /**
   * Create a new refresh token entry
   */
  async create(tokenData) {
    throw new Error("create() must be implemented");
  }

  /**
   * Find refresh token by token string
   */
  async findByToken(token) {
    throw new Error("findByToken() must be implemented");
  }

  /**
   * Find refresh token by JTI (JWT ID)
   */
  async findByJti(jti) {
    throw new Error("findByJti() must be implemented");
  }

  /**
   * Get all active sessions for a user
   */
  async findByUserId(userId) {
    throw new Error("findByUserId() must be implemented");
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id) {
    throw new Error("updateLastUsed() must be implemented");
  }

  /**
   * Revoke a specific token
   */
  async revokeToken(id) {
    throw new Error("revokeToken() must be implemented");
  }

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllForUser(userId) {
    throw new Error("revokeAllForUser() must be implemented");
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpired() {
    throw new Error("deleteExpired() must be implemented");
  }

  /**
   * Get count of active sessions for a user
   */
  async countActiveForUser(userId) {
    throw new Error("countActiveForUser() must be implemented");
  }
}
