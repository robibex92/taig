import { prisma } from "../database/prisma.js";
import { AdEntity } from "../../domain/entities/Ad.entity.js";
import { IAdRepository } from "../../domain/repositories/IAdRepository.js";
import { DatabaseError, NotFoundError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/** Порядок картинок одного объявления: главное фото первым. */
const IMAGES_ORDER_BY = [{ is_main: "desc" }, { created_at: "asc" }];

// `ad_images.ad_id` — Int, а `ads.id` — BigInt: отношения в схеме Prisma между ними нет,
// поэтому `include` не работает и картинки дотягиваются отдельным запросом.
const imagesWhere = (adId) => ({ ad_id: Number(adId) });

/**
 * Число из `price`: колонка строковая, и в ней лежит и «1200», и «1 200 ₽», и
 * «Договорная». Пусто для всего, что числом не является.
 */
const parsePriceNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const digits = String(value).replace(/[^\d.]/g, "");
  if (!digits) return null;

  const parsed = parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
};

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

      const images = await prisma.adImage.findMany({
        where: imagesWhere(id),
        orderBy: IMAGES_ORDER_BY,
      });

      return new AdEntity({ ...ad, images });
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
        priceMin,
        priceMax,
        dateFrom,
        dateTo,
        search,
      } = filters;
      const { page = 1, limit = 20 } = pagination;

      const where = this._buildWhere({
        status,
        category,
        subcategory,
        dateFrom,
        dateTo,
        search,
      });

      const safeOrder = order === "ASC" ? "asc" : "desc";
      const orderBy = { [sort]: safeOrder };
      const numericPrice =
        priceMin !== undefined || priceMax !== undefined || sort === "price";

      let ads;
      let total;

      if (numericPrice) {
        // `price` — VarChar: фильтр и сортировку по нему Prisma в SQL не выразит.
        // Такую страницу читаем целиком, считаем и режем в JS. Раньше цена
        // отфильтровывалась уже ПОСЛЕ `take: limit`, а `total` приравнивался к
        // числу оставшихся строк страницы — из-за этого `totalPages` врал, часть
        // объявлений пропадала из выдачи, а порядок был лексикографическим
        // («10000» раньше «900»).
        const rows = await prisma.ad.findMany({ where, orderBy });
        const filtered = this._filterByPrice(rows, priceMin, priceMax);
        const sorted =
          sort === "price" ? this._sortByPrice(filtered, safeOrder) : filtered;

        total = sorted.length;
        ads = sorted.slice((page - 1) * limit, (page - 1) * limit + limit);
      } else {
        [ads, total] = await prisma.$transaction([
          prisma.ad.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.ad.count({ where }),
        ]);
      }

      const withImages = await this._attachImages(ads);

      return {
        ads: withImages.map((ad) => new AdEntity(ad)),
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

  /** Общий билдер `where` для списка и для «мои объявления». */
  _buildWhere({ status, category, subcategory, dateFrom, dateTo, search, userId }) {
    const where = {};

    if (userId !== undefined) {
      where.user_id = BigInt(userId);
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = parseInt(category);
    }

    if (subcategory) {
      where.subcategory = parseInt(subcategory);
    }

    if (dateFrom || dateTo) {
      where.created_at = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  _filterByPrice(rows, priceMin, priceMax) {
    if (priceMin === undefined && priceMax === undefined) return rows;

    const min = priceMin === undefined ? null : parseFloat(priceMin);
    const max = priceMax === undefined ? null : parseFloat(priceMax);

    return rows.filter((row) => {
      const price = parsePriceNumber(row.price);
      if (price === null) return false;
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;
      return true;
    });
  }

  /** Объявления без цены (и «Договорная») всегда в конце — сравнить их нельзя. */
  _sortByPrice(rows, order) {
    const direction = order === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const left = parsePriceNumber(a.price);
      const right = parsePriceNumber(b.price);

      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;

      return (left - right) * direction;
    });
  }

  /**
   * Картинки пачкой на всю страницу.
   *
   * Отношения `ads` ↔ `ad_images` в схеме Prisma нет (типы ключей разные), поэтому
   * раньше каждая карточка списка добирала своё фото отдельным запросом — при
   * `ADS_PER_PAGE = 20` это 20 лишних round-trip'ов на страницу.
   */
  async _attachImages(ads) {
    if (!ads.length) return [];

    const images = await prisma.adImage.findMany({
      where: { ad_id: { in: ads.map((ad) => Number(ad.id)) } },
      orderBy: IMAGES_ORDER_BY,
    });

    const byAd = new Map();
    for (const image of images) {
      const bucket = byAd.get(image.ad_id) ?? [];
      bucket.push(image);
      byAd.set(image.ad_id, bucket);
    }

    return ads.map((ad) => ({ ...ad, images: byAd.get(Number(ad.id)) ?? [] }));
  }

  /** Картинки объявления перезаписываются целиком: старое удаляется, новое вставляется. */
  async _replaceImages(tx, adId, images = []) {
    await tx.adImage.deleteMany({ where: imagesWhere(adId) });

    if (!images.length) return;

    await tx.adImage.createMany({
      data: images.map((img) => ({
        ad_id: Number(adId),
        image_url: img.url,
        is_main: img.is_main || false,
        created_at: new Date(),
      })),
    });
  }

  /**
   * Find ads by user ID
   */
  async findByUserId(userId, filters = {}) {
    try {
      const { status, sort = "created_at", order = "DESC" } = filters;

      const where = this._buildWhere({ userId, status });
      const safeOrder = order === "ASC" ? "asc" : "desc";

      const ads = await prisma.ad.findMany({
        where,
        orderBy: { [sort]: safeOrder },
      });

      const withImages = await this._attachImages(ads);

      return withImages.map((ad) => new AdEntity(ad));
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
            price: price ? String(price) : null,
            status: status || "active",
            created_at: new Date(),
          },
        });

        // Save images if provided
        if (images && images.length > 0) {
          await this._replaceImages(tx, newAd.id, images);
          newAd.images = await tx.adImage.findMany({
            where: imagesWhere(newAd.id),
            orderBy: IMAGES_ORDER_BY,
          });
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
            } else if (field === "price") {
              updateData[field] = data[field] ? String(data[field]) : null;
            } else {
              updateData[field] = data[field];
            }
          }
        });


        updateData.updated_at = new Date();

        // Update ad
        const updatedAd = await tx.ad.update({
          where: { id: BigInt(id) },
          data: updateData,
        });

        // Handle images update if provided
        if (data.images !== undefined) {
          await this._replaceImages(tx, id, data.images);
        }

        // Fetch images
        const images = await tx.adImage.findMany({
          where: imagesWhere(id),
          orderBy: IMAGES_ORDER_BY,
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
      await prisma.ad.update({
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
   * Get Telegram messages for an ad
   * Returns all messages across all chats/threads where this ad was posted
   */
  async getTelegramMessagesByAdId(adId) {
    try {
      // Step 1: Fetch messages
      const messages = await prisma.telegramMessage.findMany({
        where: {
          ad_id: BigInt(adId),
        },
        orderBy: {
          created_at: "asc",
        },
      });

      if (!messages || messages.length === 0) {
        logger.info("No Telegram messages found for ad", { ad_id: adId });
        return [];
      }

      // Step 2: Fetch the ad to get the author's user_id
      const ad = await prisma.ad.findUnique({
        where: { id: BigInt(adId) },
        select: { user_id: true },
      });

      let author = null;
      // Step 3: Fetch the author if user_id exists
      if (ad && ad.user_id) {
        const user = await prisma.user.findUnique({
          where: { user_id: ad.user_id },
          select: {
            user_id: true,
            username: true,
            first_name: true,
            last_name: true,
          },
        });
        if (user) {
          author = user;
        }
      }

      logger.info("Retrieved Telegram messages for ad", {
        ad_id: adId,
        message_count: messages.length,
        chats: [...new Set(messages.map((m) => m.chat_id))].length,
        author_found: !!author,
      });

      // Step 4: Attach author to each message
      const messagesWithAuthor = messages.map((message) => ({
        ...message,
        author,
      }));

      return messagesWithAuthor;
    } catch (error) {
      logger.error("Error getting telegram messages by ad ID", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to get telegram messages", error);
    }
  }

  /**
   * Get Telegram message by message_id and chat_id
   * Used for finding which ad a user replied to
   */
  async getTelegramMessageByMessageId(messageId, chatId) {
    try {
      const message = await prisma.telegramMessage.findFirst({
        where: {
          message_id: messageId.toString(),
          chat_id: chatId.toString(),
        },
      });

      return message;
    } catch (error) {
      logger.error("Error getting telegram message by message ID", {
        error: error.message,
        messageId,
        chatId,
      });
      throw new DatabaseError("Failed to get telegram message", error);
    }
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

  /**
   * Permanently delete an ad (hard delete)
   */
  async permanentDelete(id) {
    try {
      // First delete all related images
      await prisma.adImage.deleteMany({
        where: imagesWhere(id),
      });

      // Delete all telegram messages
      await this.deleteTelegramMessagesByAdId(id);

      // Delete the ad
      await prisma.ad.delete({
        where: { id: BigInt(id) },
      });

      logger.info("Ad permanently deleted", { ad_id: id });
      return true;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Ad");
      }
      logger.error("Error permanently deleting ad", {
        error: error.message,
        id,
      });
      throw new DatabaseError("Failed to permanently delete ad", error);
    }
  }
}

export default new AdRepository();
