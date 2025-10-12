import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for getting all posts
 */
export class GetPostsUseCase {
  constructor(postRepository) {
    this.postRepository = postRepository;
  }

  async execute(filters) {
    const posts = await this.postRepository.findAll(filters);

    logger.debug("Posts retrieved", { count: posts.length, filters });

    return posts;
  }
}
