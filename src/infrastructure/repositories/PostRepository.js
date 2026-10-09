import { prisma } from "../database/prisma.js";
import { IPostRepository } from "../../domain/repositories/IPostRepository.js";
import { Post } from "../../domain/entities/Post.entity.js";

/**
 * Post Repository Implementation with Prisma
 * Handles database operations for posts/news
 */
export class PostRepository extends IPostRepository {
  _where(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.marker) {
      where.marker = filters.marker;
    }

    return where;
  }

  /**
   * Get all posts with optional filters
   */
  async findAll(filters = {}) {
    const posts = await prisma.post.findMany({
      where: this._where(filters),
      orderBy: { created_at: "desc" },
    });

    return posts.map((post) => Post.fromDatabase(post));
  }

  /**
   * Одна страница ленты и общее число подходящих записей одним обращением:
   * счётчик нужен, чтобы «Показать ещё» исчезал честно, а не по короткому ответу.
   */
  async findPage(filters = {}, page = 1, limit = 10) {
    const where = this._where(filters);
    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return { posts: posts.map((post) => Post.fromDatabase(post)), total };
  }

  /**
   * Find post by ID
   */
  async findById(id) {
    const post = await prisma.post.findUnique({
      where: { id: BigInt(id) },
    });

    return post ? Post.fromDatabase(post) : null;
  }

  /**
   * Create new post
   */
  async create(postData) {
    const post = await prisma.post.create({
      data: {
        title: postData.title,
        content: postData.content,
        image_url: postData.image_url || null,
        status: postData.status || "active",
        source: postData.source || null,
        marker: postData.marker || null,
        created_at: new Date(),
      },
    });

    return Post.fromDatabase(post);
  }

  /**
   * Update post
   */
  async update(id, updateData) {
    const post = await prisma.post.update({
      where: { id: BigInt(id) },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.content !== undefined && {
          content: updateData.content,
        }),
        ...(updateData.image_url !== undefined && {
          image_url: updateData.image_url,
        }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.source !== undefined && { source: updateData.source }),
        ...(updateData.marker !== undefined && { marker: updateData.marker }),
        updated_at: new Date(),
      },
    });

    return Post.fromDatabase(post);
  }

  /**
   * Soft delete post (set status to 'deleted')
   */
  async delete(id) {
    const post = await prisma.post.update({
      where: { id: BigInt(id) },
      data: {
        status: "deleted",
        updated_at: new Date(),
      },
    });

    return post !== null;
  }

  /**
   * Get Telegram messages for a post
   */
  async getTelegramMessagesByPostId(postId) {
    const messages = await prisma.telegramMessage.findMany({
      where: {
        post_id: BigInt(postId),
      },
      orderBy: { created_at: "asc" },
    });

    return messages;
  }

  /**
   * Create Telegram message record
   */
  async createTelegramMessage(messageData) {
    const message = await prisma.telegramMessage.create({
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

    return message;
  }

  /**
   * Delete Telegram messages for a post
   */
  async deleteTelegramMessagesByPostId(postId) {
    await prisma.telegramMessage.deleteMany({
      where: {
        post_id: BigInt(postId),
      },
    });
  }
}
