import { prisma } from "../database/prisma.js";
import { IRefreshTokenRepository } from "../../domain/repositories/IRefreshTokenRepository.js";
import { RefreshToken } from "../../domain/entities/RefreshToken.entity.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Refresh Token Repository Implementation with Prisma
 * Handles storage and retrieval of refresh tokens (sessions)
 */
export class RefreshTokenRepository extends IRefreshTokenRepository {
  /**
   * Create a new refresh token entry
   */
  async create(tokenData) {
    const token = await prisma.refreshToken.create({
      data: {
        user_id: BigInt(tokenData.user_id),
        token: tokenData.token,
        jti: tokenData.jti,
        device_fingerprint: tokenData.device_fingerprint || null,
        ip_address: tokenData.ip_address || null,
        user_agent: tokenData.user_agent || null,
        device_info: tokenData.device_info || {},
        expires_at: tokenData.expires_at,
        created_at: new Date(),
        last_used_at: new Date(),
        is_revoked: false,
      },
    });

    return RefreshToken.fromDatabase(token);
  }

  /**
   * Find refresh token by token string
   */
  async findByToken(token) {
    const refreshToken = await prisma.refreshToken.findFirst({
      where: {
        token,
        is_revoked: false,
        expires_at: {
          gte: new Date(), // Only non-expired tokens
        },
      },
    });

    return refreshToken ? RefreshToken.fromDatabase(refreshToken) : null;
  }

  /**
   * Find refresh token by JTI (JWT ID)
   */
  async findByJti(jti) {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { jti },
    });

    return refreshToken ? RefreshToken.fromDatabase(refreshToken) : null;
  }

  /**
   * Get all active sessions for a user
   */
  async findByUserId(userId) {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        user_id: BigInt(userId),
        is_revoked: false,
        expires_at: {
          gte: new Date(),
        },
      },
      orderBy: {
        last_used_at: "desc",
      },
    });

    return tokens.map((token) => RefreshToken.fromDatabase(token));
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id) {
    await prisma.refreshToken.update({
      where: { id: BigInt(id) },
      data: {
        last_used_at: new Date(),
      },
    });
  }

  /**
   * Revoke a specific token
   */
  async revokeToken(id) {
    await prisma.refreshToken.update({
      where: { id: BigInt(id) },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Revoke token by token string
   */
  async revokeByToken(token) {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Revoke token by JTI
   */
  async revokeByJti(jti) {
    await prisma.refreshToken.update({
      where: { jti },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllForUser(userId) {
    await prisma.refreshToken.updateMany({
      where: {
        user_id: BigInt(userId),
        is_revoked: false,
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Revoke all tokens for user by platform (for unlinking)
   */
  async revokeAllByUserAndPlatform(userId, platform) {
    await prisma.refreshToken.updateMany({
      where: {
        user_id: BigInt(userId),
        platform: platform,
        is_revoked: false,
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
      },
    });

    logger.info("All tokens revoked for user and platform", {
      userId,
      platform,
    });
  }

  /**
   * Revoke all tokens except current one (logout from other devices)
   */
  async revokeAllExcept(userId, currentJti) {
    await prisma.refreshToken.updateMany({
      where: {
        user_id: BigInt(userId),
        jti: {
          not: currentJti,
        },
        is_revoked: false,
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpired() {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Delete revoked tokens older than X days
   */
  async deleteRevokedOlderThan(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.refreshToken.deleteMany({
      where: {
        is_revoked: true,
        revoked_at: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get count of active sessions for a user
   */
  async countActiveForUser(userId) {
    return await prisma.refreshToken.count({
      where: {
        user_id: BigInt(userId),
        is_revoked: false,
        expires_at: {
          gte: new Date(),
        },
      },
    });
  }

  /**
   * Get all sessions (active and revoked) for a user
   */
  async getAllForUser(userId) {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        user_id: BigInt(userId),
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return tokens.map((token) => RefreshToken.fromDatabase(token));
  }
}
