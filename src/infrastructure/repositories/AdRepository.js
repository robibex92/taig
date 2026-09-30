import { prisma } from "../database/prisma.js";
import { AdEntity } from "../../domain/entities/Ad.entity.js";
import { IAdRepository } from "../../domain/repositories/IAdRepository.js";
import { DatabaseError, NotFoundError } from "../../core/errors/AppError.js";
import { AD_SORT_FIELDS, AD_STATUS } from "../../core/constants/index.js";
import { logger } from "../../core/utils/logger.js";

/** Порядок картинок одного объявления: главное фото первым. */
const IMAGES_ORDER_BY = [{ is_main: "desc" }, { created_at: "asc" }];

/**
 * Поля, по которым список может сортироваться в базе. Порядок приходит из URL,
 * поэтому в `orderBy` попадает только по имени из этого белого списка.
 */
const SORT_FIELDS = new Set(Object.values(AD_SORT_FIELDS));

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

      // Названия справочников нужны самой карточке: страница объявления раньше
      // тянула категории и подкатегории отдельными запросами, хотя id уже был.
      const [withNames] = await this._attachCategoryNames([ad]);

      return new AdEntity({ ...withNames, images });
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
      const { rows: ads, total } = await this._page(where, {
        orderBy: this._orderBy(sort, safeOrder),
        sort,
        order: safeOrder,
        priceMin,
        priceMax,
        offset: (page - 1) * limit,
        limit,
      });

      const withImages = await this._decorate(ads);

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

  /**
   * Страница объявлений: `where` + `orderBy` + срез.
   *
   * Единственное исключение — строковая `price`: в SQL она ни фильтруется, ни
   * сортируется честно, поэтому такую страницу читаем целиком и режем в JS.
   * Раньше цена отфильтровывалась уже ПОСЛЕ `take: limit`, а `total` приравнивался
   * к числу строк страницы — из-за этого `totalPages` врал, часть объявлений
   * пропадала из выдачи, а порядок был лексикографическим («10000» раньше «900»).
   */
  async _page(
    where,
    { orderBy, sort, order, priceMin, priceMax, offset, limit }
  ) {
    const needsJsPrice =
      sort === "price" || priceMin !== undefined || priceMax !== undefined;

    if (!needsJsPrice) {
      const [rows, total] = await prisma.$transaction([
        prisma.ad.findMany({
          where,
          orderBy,
          ...(limit === undefined ? {} : { skip: offset, take: limit }),
        }),
        prisma.ad.count({ where }),
      ]);

      return { rows, total };
    }

    const rows = await prisma.ad.findMany({ where, orderBy });
    const filtered = this._filterByPrice(rows, priceMin, priceMax);
    const sorted =
      sort === "price" ? this._sortByPrice(filtered, order) : filtered;

    return {
      rows: limit === undefined ? sorted : sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  /**
   * `orderBy` для списка: в него попадает только поле из белого списка
   * `SORT_FIELDS` — порядок приходит из URL и прямо в SQL не уходит.
   */
  _orderBy(sort, order) {
    const field = SORT_FIELDS.has(sort) ? sort : AD_SORT_FIELDS.CREATED_AT;
    return { [field]: order };
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
   * Страница объявлений в том виде, в котором она уходит на фронт: картинки и
   * названия категорий дотягиваются пачкой на весь список, по запросу на каждую.
   */
  async _decorate(rows) {
    return this._attachCategoryNames(await this._attachImages(rows));
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
   * Объявления одного пользователя — теми же фильтрами, что и витрина.
   *
   * Раньше сюда доходили только `status`/`sort`/`order` и без лимита: страница
   * «Мои объявления» читала все строки целиком и фильтровала их по вкладкам в
   * браузере, поэтому ни пагинация, ни фильтр по категории там не работали, а
   * счётчики вкладок считались по уже отфильтрованному списку.
   *
   * @returns {Promise<{ads: AdEntity[], total: number}>}
   */
  async findByUserId(userId, filters = {}) {
    try {
      const {
        status,
        category,
        subcategory,
        search,
        sort = "created_at",
        order = "DESC",
        limit,
        offset = 0,
      } = filters;

      const where = this._buildWhere({
        userId,
        status,
        category,
        subcategory,
        search,
      });
      const safeOrder = order === "ASC" ? "asc" : "desc";

      const { rows, total } = await this._page(where, {
        orderBy: this._orderBy(sort, safeOrder),
        sort,
        order: safeOrder,
        offset: Number(offset) || 0,
        limit: limit === undefined ? undefined : Number(limit),
      });

      const withImages = await this._decorate(rows);

      return { ads: withImages.map((ad) => new AdEntity(ad)), total };
    } catch (error) {
      logger.error("Error finding ads by user ID", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to find user ads", error);
    }
  }

  /**
   * Сводка по объявлениям пользователя: сколько в каждом состоянии и сколько
   * просмотров они дают суммарно — одним `groupBy`.
   *
   * Нужна потому, что список теперь страницный: посчитать эти числа «на фронте»
   * можно только по одной странице, и счётчик просмотров врал бы на второй.
   *
   * Фильтры (`category`, `search`) учитываются, а `status` — нет: состояния и
   * есть то, что сводка разбивает.
   */
  async summarizeForUser(userId, filters = {}) {
    const where = this._buildWhere({ userId, ...filters, status: undefined });

    const grouped = await prisma.ad.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { view_count: true },
    });

    const byStatus = Object.fromEntries(
      Object.values(AD_STATUS).map((status) => [status, 0])
    );

    let total = 0;
    let totalViews = 0;

    for (const row of grouped) {
      const count = row._count._all;
      total += count;
      totalViews += row._sum.view_count ?? 0;

      if (row.status in byStatus) {
        byStatus[row.status] = count;
      }
    }

    return { byStatus, total, totalViews };
  }

  /**
   * Названия категории и подкатегории пачкой на страницу.
   *
   * Карточки списка показывали `category_name`, которого в ответе никогда не
   * было, — чип категории молча не рисовался. Отношений в схеме Prisma для
   * `category`/`subcategory` нет только у сущности-обёртки, поэтому читаем
   * справочники отдельным запросом, как картинки.
   */
  async _attachCategoryNames(ads) {
    if (!ads.length) return [];

    const categoryIds = [
      ...new Set(ads.map((ad) => ad.category).filter((id) => id != null)),
    ];
    const subcategoryIds = [
      ...new Set(ads.map((ad) => ad.subcategory).filter((id) => id != null)),
    ];

    const [categories, subcategories] = await Promise.all([
      categoryIds.length
        ? prisma.category.findMany({
            where: { id: { in: categoryIds.map((id) => BigInt(id)) } },
            select: { id: true, name: true },
          })
        : [],
      subcategoryIds.length
        ? prisma.subcategory.findMany({
            where: { id: { in: subcategoryIds.map((id) => BigInt(id)) } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const categoryNames = new Map(categories.map((c) => [String(c.id), c.name]));
    const subcategoryNames = new Map(subcategories.map((s) => [String(s.id), s.name]));

    return ads.map((ad) => ({
      ...ad,
      category_name: categoryNames.get(String(ad.category)) ?? null,
      subcategory_name: subcategoryNames.get(String(ad.subcategory)) ?? null,
    }));
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
   *
   * Сырым запросом, а не `ad.update`: `updated_at` помечен `@updatedAt`, и
   * инкремент на каждом просмотре сдвигал бы время правки. А он же — якорь
   * авто-архива (`archiveOldAds`), так что популярное объявление не устаревало бы никогда.
   */
  async incrementViewCount(id) {
    try {
      await prisma.$executeRaw`
        UPDATE ads
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = ${BigInt(id)}
      `;

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
   * «Отметить актуальность»: сдвигает якорь устаревания на текущий момент.
   * Только `updated_at` — статус и остальные поля не трогаем.
   */
  async markRelevant(id) {
    try {
      const updated = await prisma.ad.update({
        where: { id: BigInt(id) },
        data: { updated_at: new Date() },
        select: { id: true, updated_at: true },
      });

      return { id: updated.id, updatedAt: updated.updated_at };
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Ad");
      }
      logger.error("Error marking ad relevant", { error: error.message, id });
      throw new DatabaseError("Failed to mark ad relevant", error);
    }
  }

  /**
   * Авто-архив устаревших объявлений.
   *
   * Срок отсчитывается от последней правки (`updated_at`), а у строки без
   * правок — от `created_at`. Возвращает число переведённых в архив.
   */
  async archiveOldAds(days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.ad.updateMany({
        where: {
          status: AD_STATUS.ACTIVE,
          OR: [
            { updated_at: { lt: cutoff } },
            { updated_at: null, created_at: { lt: cutoff } },
          ],
        },
        data: { status: AD_STATUS.ARCHIVE },
      });

      logger.info("Old ads archived", { count: result.count, cutoff });

      return result.count;
    } catch (error) {
      logger.error("Error archiving old ads", { error: error.message });
      throw new DatabaseError("Failed to archive old ads", error);
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
   * Журнал публикации в MAX (`max_ad_messages`): одна строка на чат.
   * Нужен, чтобы repost и архивация снимали именно те сообщения, которые бот
   * оставлял, а не угадывали их.
   */
  async createMaxMessage({ ad_id, chat_id, message_id }) {
    return await prisma.maxAdMessage.create({
      data: {
        ad_id: BigInt(ad_id),
        chat_id: BigInt(chat_id),
        message_id: String(message_id),
      },
    });
  }

  async getMaxMessagesByAdId(adId) {
    return await prisma.maxAdMessage.findMany({
      where: { ad_id: BigInt(adId) },
      orderBy: { created_at: "asc" },
    });
  }

  async deleteMaxMessagesByAdId(adId) {
    await prisma.maxAdMessage.deleteMany({ where: { ad_id: BigInt(adId) } });
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

      // Messages the ad left in MAX chats
      await this.deleteMaxMessagesByAdId(id);

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
