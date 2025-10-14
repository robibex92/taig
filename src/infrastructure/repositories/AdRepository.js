import { prisma } from "../database/prisma.js";
import { AdEntity } from "../../domain/entities/Ad.entity.js";
import { IAdRepository } from "../../domain/repositories/IAdRepository.js";
import { DatabaseError, NotFoundError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Prisma implementation of Ad Repository
 */
export class AdRepository extends IAdRepository {
  /**
   * Find ad by ID
   */
  async findById(id) {
    try {
      const ad = await prisma.ad.findUnique({
        where: { id: BigInt(id) },
      });

      if (!ad) {
        return null;
      }

      // Получаем изображения отдельно из-за несоответствия типов (Ad.id BigInt vs AdImage.ad_id Int)
      const images = await prisma.adImage.findMany({
        where: { ad_id: Number(id) },
        orderBy: [{ is_main: "desc" }, { created_at: "asc" }],
      });

      return new AdEntity({ ...ad, images: images || [] });
    } catch (error) {
      logger.error("Error finding ad by ID", { error: error.message, id });
      throw new DatabaseError("Failed to find ad", error);
    }
  }

  /**
   * Find all ads with filters and pagination
   */
  async findAll(filters = {}, pagination = {}) {
    try {
      const {
        status,
        category,
        subcategory,
        sort = "created_at",
        order = "DESC",
      } = filters;
      const { page = 1, limit = 20 } = pagination;

      const where = {};

      if (status) {
        where.status = status;
      }

      if (category) {
        where.category = parseInt(category);
      }

      if (subcategory) {
        where.subcategory = parseInt(subcategory);
      }

      // Build orderBy
      let orderBy;
      const safeOrder = order === "ASC" ? "asc" : "desc";

      if (sort === "price") {
        // For price sorting, we'll use raw SQL since it's stored as string
        orderBy = { price: safeOrder };
      } else {
        orderBy = { [sort]: safeOrder };
      }

      // Get ads with pagination
      const [ads, total] = await prisma.$transaction([
        prisma.ad.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.ad.count({ where }),
      ]);

      const adEntities = ads.map((ad) => new AdEntity(ad));

      return {
        ads: adEntities,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error("Error finding ads", { error: error.message, filters });
      throw new DatabaseError("Failed to find ads", error);
    }
  }

  /**
   * Find ads by user ID
   */
  async findByUserId(userId, filters = {}) {
    try {
      const { status, sort = "created_at", order = "DESC" } = filters;

      const where = {
        user_id: BigInt(userId),
      };

      if (status) {
        where.status = status;
      }

      const safeOrder = order === "ASC" ? "asc" : "desc";
      const orderBy = { [sort]: safeOrder };

      const ads = await prisma.ad.findMany({
        where,
        orderBy,
      });

      return ads.map((ad) => new AdEntity(ad));
    } catch (error) {
      logger.error("Error finding ads by user ID", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to find user ads", error);
    }
  }

  /**
   * Create a new ad
   */
  async create(adData) {
    try {
      const ad = await prisma.$transaction(async (tx) => {
        const {
          user_id,
          title,
          content,
          category,
          subcategory,
          price,
          status,
          images,
        } = adData;

        // Create ad
        const newAd = await tx.ad.create({
          data: {
            user_id: user_id ? BigInt(user_id) : null,
            title,
            content,
            category: category ? parseInt(category) : null,
            subcategory: subcategory ? parseInt(subcategory) : null,
            price,
            status: status || "active",
            created_at: new Date(),
          },
        });

        // Save images if provided
        if (images && images.length > 0) {
          await tx.adImage.createMany({
            data: images.map((img) => ({
              ad_id: Number(newAd.id),
              image_url: img.url,
              is_main: img.is_main || false,
              created_at: new Date(),
            })),
          });

          // Fetch saved images
          const savedImages = await tx.adImage.findMany({
            where: { ad_id: Number(newAd.id) },
            orderBy: [{ is_main: "desc" }, { created_at: "asc" }],
          });

          newAd.images = savedImages;
        }

        return newAd;
      });

      const adEntity = new AdEntity(ad);
      logger.info("Ad created", {
        ad_id: adEntity.id,
        user_id: adEntity.user_id,
      });
      return adEntity;
    } catch (error) {
      logger.error("Error creating ad", { error: error.message });
      throw new DatabaseError("Failed to create ad", error);
    }
  }

  /**
   * Update an ad
   */
  async update(id, data) {
    try {
      const ad = await prisma.$transaction(async (tx) => {
        // Build update data
        const updateData = {};

        const allowedFields = [
          "title",
          "content",
          "category",
          "subcategory",
          "price",
          "status",
        ];

        allowedFields.forEach((field) => {
          if (data[field] !== undefined) {
            if (field === "category" || field === "subcategory") {
              updateData[field] = data[field] ? parseInt(data[field]) : null;
            } else {
              updateData[field] = data[field];
            }
          }
        });

        if (Object.keys(updateData).length === 0 && data.images === undefined) {
          throw new Error("No valid fields to update");
        }

        updateData.updated_at = new Date();

        // Update ad
        const updatedAd = await tx.ad.update({
          where: { id: BigInt(id) },
          data: updateData,
        });

        // Handle images update if provided
        if (data.images !== undefined) {
          // Delete existing images
          await tx.adImage.deleteMany({
            where: { ad_id: Number(id) },
          });

          // Insert new images
          if (data.images.length > 0) {
            await tx.adImage.createMany({
              data: data.images.map((img) => ({
                ad_id: Number(id),
                image_url: img.url,
                is_main: img.is_main || false,
                created_at: new Date(),
              })),
            });
          }
        }

        // Fetch images
        const images = await tx.adImage.findMany({
          where: { ad_id: Number(id) },
          orderBy: [{ is_main: "desc" }, { created_at: "asc" }],
        });

        updatedAd.images = images;
        return updatedAd;
      });

      logger.info("Ad updated", { ad_id: id });
      return new AdEntity(ad);
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Ad");
      }
      logger.error("Error updating ad", { error: error.message, id });
      throw new DatabaseError("Failed to update ad", error);
    }
  }

  /**
   * Delete an ad (soft delete by setting status to 'deleted')
   */
  async delete(id) {
    try {
      const ad = await prisma.ad.update({
        where: { id: BigInt(id) },
        data: {
          status: "deleted",
          updated_at: new Date(),
        },
      });

      logger.info("Ad deleted (soft)", { ad_id: id });
      return true;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Ad");
      }
      logger.error("Error deleting ad", { error: error.message, id });
      throw new DatabaseError("Failed to delete ad", error);
    }
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id) {
    try {
      await prisma.ad.update({
        where: { id: BigInt(id) },
        data: {
          view_count: {
            increment: 1,
          },
        },
      });
      return true;
    } catch (error) {
      logger.error("Error incrementing view count", {
        error: error.message,
        id,
      });
      return false;
    }
  }

  /**
   * Get Telegram messages for an ad
   */
  async getTelegramMessagesByAdId(adId) {
    return await prisma.telegramMessage.findMany({
      where: {
        ad_id: BigInt(adId),
      },
      orderBy: { created_at: "asc" },
    });
  }

  /**
   * Create Telegram message record
   */
  async createTelegramMessage(messageData) {
    return await prisma.telegramMessage.create({
      data: {
        post_id: messageData.post_id ? BigInt(messageData.post_id) : null,
        ad_id: messageData.ad_id ? BigInt(messageData.ad_id) : null,
        chat_id: messageData.chat_id,
        message_id: messageData.message_id,
        thread_id: messageData.thread_id || null,
        message_text: messageData.message_text || null,
        caption: messageData.caption || null,
        is_media: messageData.is_media || false,
        media_group_id: messageData.media_group_id
          ? BigInt(messageData.media_group_id)
          : null,
        price: messageData.price || null,
        created_at: new Date(),
      },
    });
  }

  /**
   * Delete Telegram messages for an ad
   */
  async deleteTelegramMessagesByAdId(adId) {
    await prisma.telegramMessage.deleteMany({
      where: {
        ad_id: BigInt(adId),
      },
    });
  }
}

export default new AdRepository();
