import { prisma } from "../database/prisma.js";
import { AdEntity } from "../../domain/entities/Ad.entity.js";
import { IAdRepository } from "../../domain/repositories/IAdRepository.js";
import { DatabaseError, NotFoundError } from "../../core/errors/AppError.js";
import { AD_OFFER_TYPE, AD_SORT_FIELDS, AD_STATUS } from "../../core/constants/index.js";
import { priceToDecimal } from "../../core/utils/price.js";
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
 * Числовая колонка цены вместо разбора строки в JS. `price_value` появляется из
 * `price` по правилу `core/utils/price.js` и заполняется миграцией
 * `add_ad_price_value.sql`.
 */
const priceOrderBy = (order) => ({ price_value: { sort: order, nulls: "last" } });

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
        authorIds,
      } = filters;
      const { page = 1, limit = 20 } = pagination;

      const where = this._buildWhere({
        status,
        category,
        subcategory,
        dateFrom,
        dateTo,
        search,
        priceMin,
        priceMax,
        authorIds,
      });

      const safeOrder = order === "ASC" ? "asc" : "desc";
      const { rows: ads, total } = await this._page(where, {
        orderBy: this._orderBy(sort, safeOrder),
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
   * Страница объявлений: `where` + `orderBy` + срез, одним обращением за
   * строками и за `total`.
   *
   * Раньше здесь был второй путь — «строка в `price` не сортируется в SQL,
   * читаем всю выборку и режем в JS». Он стоил линейного роста запроса и
   * молча терял объявления, если фильтр цены отсекал строки после `take`.
   * С колонкой `price_value` оба случая идут через базу.
   */
  async _page(where, { orderBy, offset, limit }) {
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

  /**
   * `orderBy` для списка: в него попадает только поле из белого списка
   * `SORT_FIELDS` — порядок приходит из URL и прямо в SQL не уходит.
   */
  _orderBy(sort, order) {
    const field = SORT_FIELDS.has(sort) ? sort : AD_SORT_FIELDS.CREATED_AT;

    // Объявления без цены (и «Договорная») в конце — сравнить их нельзя.
    return field === AD_SORT_FIELDS.PRICE ? priceOrderBy(order) : { [field]: order };
  }

  /** Общий билдер `where` для списка, для «мои объявления» и для сводки. */
  _buildWhere({
    status,
    category,
    subcategory,
    dateFrom,
    dateTo,
    search,
    priceMin,
    priceMax,
    userId,
    authorIds,
  }) {
    const where = {};

    if (userId !== undefined) {
      where.user_id = BigInt(userId);
    }

    // Список id авторов: «только мой дом» отдаёт объявления соседей.
    // `in: []` Prisma трактует как «ни одной строки» — ровно то, что нужно,
    // когда в доме больше никого нет.
    if (authorIds !== undefined) {
      where.user_id = { in: authorIds.map((id) => BigInt(id)) };
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

    if (priceMin !== undefined || priceMax !== undefined) {
      where.price_value = {
        not: null,
        ...(priceMin !== undefined && { gte: Number(priceMin) }),
        ...(priceMax !== undefined && { lte: Number(priceMax) }),
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

  /**
   * Тип предложения и срок.
   *
   * Правило одно и при создании, и при правке: срок живёт только у проката,
   * иначе объявление, переведённое обратно в продажу, осталось бы
   * «продам на 3 дня».
   *
   * Пара трогается целиком и только когда в данных есть хотя бы одно из двух:
   * правка без них не должна менять тип и стирать срок.
   */
  _offerFields({ offer_type, rental_days }) {
    if (offer_type === undefined && rental_days === undefined) return {};

    const type = offer_type ?? AD_OFFER_TYPE.SALE;

    return {
      offer_type: type,
      rental_days:
        type === AD_OFFER_TYPE.RENT && rental_days != null ? Number(rental_days) : null,
    };
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
        dateFrom,
        dateTo,
        priceMin,
        priceMax,
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
        dateFrom,
        dateTo,
        priceMin,
        priceMax,
      });
      const safeOrder = order === "ASC" ? "asc" : "desc";

      const { rows, total } = await this._page(where, {
        orderBy: this._orderBy(sort, safeOrder),
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
   * просмотров они дают суммарно.
   *
   * Нужна потому, что список теперь страницный: посчитать эти числа «на фронте»
   * можно только по одной странице, и счётчик просмотров врал бы на второй.
   *
   * Считается по тем же фильтрам, что и список, — включая цену, — иначе чипы
   * вкладок показывали бы число всех объявлений, а под ними лежала отфильтрованная
   * пустота. `status` не участвует: состояния сводка как раз и разбивает.
   */
  async summarizeForUser(userId, filters = {}) {
    const where = this._buildWhere({ userId, ...filters, status: undefined });

    const groups = await prisma.ad.groupBy({
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

    for (const group of groups) {
      const count = group._count?._all ?? 0;

      total += count;
      totalViews += Number(group._sum?.view_count ?? 0);

      if (group.status in byStatus) {
        byStatus[group.status] = count;
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
            // Число рядом со строкой: по нему сортировка и диапазон цен.
            price_value: priceToDecimal(price),
            ...this._offerFields(adData),
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
              // Числовая колонка живёт по той же цене, что и строка, — иначе
              // сортировка показывала бы старое число рядом с новой ценой.
              updateData.price_value = priceToDecimal(data[field]);
            } else {
              updateData[field] = data[field];
            }
          }
        });


        // Тип предложения и срок — одним правилом (см. _offerFields), а не
        // двумя полями из whitelist: правка «прокат → продажа» обязана снять срок.
        Object.assign(updateData, this._offerFields(data));

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
