import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for getting posts page
 *
 * `limit` отсутствует только у тех, кто хочет всю ленту разом (таких вызовов в
 * приложении нет) — иначе страница ответов была бы неограниченной.
 */
export class GetPostsUseCase {
  constructor(postRepository) {
    this.postRepository = postRepository;
  }

  async execute(filters = {}, page = 1, limit = null) {
    if (!limit) {
      const posts = await this.postRepository.findAll(filters);
      logger.debug("Posts retrieved", { count: posts.length, filters });

      return { posts, total: posts.length };
    }

    const { posts, total } = await this.postRepository.findPage(filters, page, limit);
    logger.debug("Posts page retrieved", { count: posts.length, total, page, limit });

    return { posts, total };
  }
}
