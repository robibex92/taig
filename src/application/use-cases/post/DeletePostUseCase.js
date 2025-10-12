import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for deleting (closing) a post
 */
export class DeletePostUseCase {
  constructor(postRepository, telegramService) {
    this.postRepository = postRepository;
    this.telegramService = telegramService;
  }

  async execute(postId) {
    // 1. Check if post exists
    const existingPost = await this.postRepository.findById(postId);
    if (!existingPost) {
      throw new NotFoundError("Post");
    }

    // 2. Get Telegram messages for this post
    const telegramMessages =
      await this.postRepository.getTelegramMessagesByPostId(postId);

    // 3. Delete Telegram messages
    if (telegramMessages.length > 0) {
      this.telegramService.queueTask(async () => {
        try {
          await this.telegramService.deleteMessages(telegramMessages);
          logger.info("Telegram messages deleted for post", {
            post_id: postId,
            count: telegramMessages.length,
          });
        } catch (error) {
          logger.error("Error deleting Telegram messages for post", {
            post_id: postId,
            error: error.message,
          });
        }
      });

      // 4. Remove telegram message records from database
      await this.postRepository.deleteTelegramMessages(postId);
    }

    // 5. Update post status to deleted
    await this.postRepository.delete(postId);

    logger.info("Post deleted", { post_id: postId });

    return { success: true, message: "Post deleted successfully" };
  }
}
