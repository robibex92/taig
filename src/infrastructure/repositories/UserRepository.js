import { prisma } from "../database/prisma.js";
import { UserEntity } from "../../domain/entities/User.entity.js";
import { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import { DatabaseError, NotFoundError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Prisma where-clause for the admin user list (search + role filters).
 * `role` matches one role, `excludeRoles` matches users holding none of them.
 */
function buildUserWhere({ search, role, excludeRoles } = {}) {
  const AND = [];

  if (search) {
    const textSearch = {
      OR: [
        { username: { contains: search, mode: "insensitive" } },
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
      ],
    };

    // Administrators search residents by Telegram / MAX / internal ID as often as by name
    const numericId = /^\d+$/.test(search.trim()) ? BigInt(search.trim()) : null;
    AND.push(
      numericId === null
        ? textSearch
        : {
            OR: [
              ...textSearch.OR,
              { user_id: numericId },
              { telegram_id: numericId },
              { max_id: numericId },
            ],
          }
    );
  }

  if (role) {
    AND.push({ roles: { has: role } });
  }

  if (Array.isArray(excludeRoles) && excludeRoles.length) {
    AND.push({ NOT: { roles: { hasSome: excludeRoles } } });
  }

  return AND.length ? { AND } : {};
}

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
      const id = BigInt(telegramId);
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ telegram_id: id }, { user_id: id, telegram_id: null, max_id: null }],
        },
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
      const {
        user_id,
        username,
        first_name,
        last_name,
        avatar,
        telegram_id,
        max_id,
        max_username,
        max_first_name,
        max_last_name,
        max_avatar,
      } = userData;

      const data = {
        username: username || null,
        first_name: first_name || null,
        last_name: last_name || null,
        avatar: avatar || null,
        joined_at: new Date(),
        telegram_id:
          telegram_id != null
            ? BigInt(telegram_id)
            : user_id != null && max_id == null && telegram_id === undefined
              ? BigInt(user_id)
              : null,
        max_id: max_id != null ? BigInt(max_id) : null,
        max_username: max_username || null,
        max_first_name: max_first_name || null,
        max_last_name: max_last_name || null,
        max_avatar: max_avatar || null,
      };

      if (user_id != null) {
        data.user_id = BigInt(user_id);
      }

      const user = await prisma.user.create({ data });

      logger.info("User created", { user_id: user.user_id, max_id: user.max_id });
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
    let updateData = {};
    try {
      const allowedFields = [
        "username",
        "first_name",
        "last_name",
        "avatar",
        "telegram_first_name",
        "telegram_last_name",
        "telegram_id",
        "max_id",
        "max_username",
        "max_first_name",
        "max_last_name",
        "max_avatar",
        "is_manually_updated",
        "roles",
      ];

      allowedFields.forEach((field) => {
        if (data[field] !== undefined) {
          // Trim string fields
          if (field === "roles") {
            updateData[field] = Array.isArray(data.roles) ? data.roles : [];
          } else if (typeof data[field] === "string" && field !== "avatar") {
            updateData[field] = data[field].trim();
          } else if (field === "is_manually_updated" && typeof data[field] === "boolean") {
            // Prisma schema expects String for is_manually_updated
            updateData[field] = data[field] ? "true" : "false";
          } else if (field === "telegram_id" || field === "max_id") {
            updateData[field] = data[field] == null ? null : BigInt(data[field]);
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

  /**
   * Replace the user's role list
   */
  async setRoles(userId, roles) {
    try {
      const user = await prisma.user.update({
        where: { user_id: BigInt(userId) },
        data: { roles },
      });

      logger.info("User roles updated", { user_id: userId, roles });
      return new UserEntity(user);
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("User");
      }
      logger.error("Error updating user roles", {
        error: error.message,
        userId,
        roles,
      });
      throw new DatabaseError("Failed to update user roles", error);
    }
  }

  /**
   * Find all users with filters
   */
  async findAll(options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      const where = buildUserWhere(options);

      const users = await prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { joined_at: "desc" },
      });

      return users.map((user) => new UserEntity(user));
    } catch (error) {
      logger.error("Error finding all users", {
        error: error.message,
        options,
      });
      throw new DatabaseError("Failed to find users", error);
    }
  }

  /**
   * Count users with filters
   */
  async count(filters = {}) {
    try {
      const count = await prisma.user.count({ where: buildUserWhere(filters) });
      return count;
    } catch (error) {
      logger.error("Error counting users", {
        error: error.message,
        filters,
      });
      throw new DatabaseError("Failed to count users", error);
    }
  }
}

export default new UserRepository();
