import { prisma } from "../database/prisma.js";
import { UserEntity } from "../../domain/entities/User.entity.js";
import { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import { DatabaseError, NotFoundError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Prisma implementation of User Repository
 */
export class UserRepository extends IUserRepository {
  /**
   * Find user by ID
   */
  async findById(id) {
    try {
      const user = await prisma.user.findUnique({
        where: { user_id: BigInt(id) },
      });

      if (!user) {
        return null;
      }

      return new UserEntity(user);
    } catch (error) {
      logger.error("Error finding user by ID", { error: error.message, id });
      throw new DatabaseError("Failed to find user", error);
    }
  }

  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId) {
    try {
      const user = await prisma.user.findUnique({
        where: { user_id: BigInt(telegramId) },
      });

      if (!user) {
        return null;
      }

      return new UserEntity(user);
    } catch (error) {
      logger.error("Error finding user by Telegram ID", {
        error: error.message,
        telegramId,
      });
      throw new DatabaseError("Failed to find user", error);
    }
  }

  /**
   * Find user by MAX ID
   */
  async findByMaxId(maxId) {
    try {
      const user = await prisma.user.findUnique({
        where: { max_id: BigInt(maxId) },
      });

      if (!user) {
        return null;
      }

      return new UserEntity(user);
    } catch (error) {
      logger.error("Error finding user by MAX ID", {
        error: error.message,
        maxId,
      });
      throw new DatabaseError("Failed to find user", error);
    }
  }

  /**
   * Create a new user
   */
  async create(userData) {
    try {
      const { user_id, username, first_name, last_name, avatar } = userData;

      const user = await prisma.user.create({
        data: {
          user_id: BigInt(user_id),
          username: username || null,
          first_name: first_name || null,
          last_name: last_name || null,
          avatar: avatar || null,
          joined_at: new Date(),
        },
      });

      logger.info("User created", { user_id: user.user_id });
      return new UserEntity(user);
    } catch (error) {
      logger.error("Error creating user", { error: error.message });
      throw new DatabaseError("Failed to create user", error);
    }
  }

  /**
   * Update a user
   */
  async update(id, data) {
    try {
      const updateData = {};

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
          // Trim string fields
          if (typeof data[field] === "string" && field !== "avatar") {
            updateData[field] = data[field].trim();
          } else {
            updateData[field] = data[field];
          }
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields to update");
      }

      const user = await prisma.user.update({
        where: { user_id: BigInt(id) },
        data: updateData,
      });

      logger.info("User updated", {
        user_id: id,
        fields: Object.keys(updateData),
      });
      return new UserEntity(user);
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("User");
      }
      logger.error("Error updating user", {
        error: error.message,
        stack: error.stack,
        id,
        data: updateData,
      });
      throw new DatabaseError("Failed to update user", error);
    }
  }

  /**
   * Save refresh token
   */
  async saveRefreshToken(userId, token) {
    try {
      await prisma.user.update({
        where: { user_id: BigInt(userId) },
        data: {
          refresh_token: token,
        },
      });

      logger.info("Refresh token saved", { user_id: userId });
    } catch (error) {
      logger.error("Error saving refresh token", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to save refresh token", error);
    }
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { user_id: BigInt(userId) },
        select: { refresh_token: true },
      });

      return user?.refresh_token || null;
    } catch (error) {
      logger.error("Error getting refresh token", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to get refresh token", error);
    }
  }

  /**
   * Clear refresh token
   */
  async clearRefreshToken(userId) {
    try {
      await prisma.user.update({
        where: { user_id: BigInt(userId) },
        data: {
          refresh_token: null,
        },
      });

      logger.info("Refresh token cleared", { user_id: userId });
    } catch (error) {
      logger.error("Error clearing refresh token", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to clear refresh token", error);
    }
  }
}

export default new UserRepository();
