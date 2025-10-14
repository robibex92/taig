import {
  NotFoundError,
  ForbiddenError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for updating a post
 */
export class UpdatePostUseCase {
  constructor(postRepository, telegramService) {
    this.postRepository = postRepository;
    this.telegramService = telegramService;
  }

  async execute(postId, updateData, user) {
    // Authorization: Only admins and moderators can update posts
    if (!user || (user.status !== "admin" && user.status !== "moderator")) {
      logger.warn("Unauthorized attempt to update post", {
        userId: user?.user_id,
        status: user?.status,
        postId,
      });
      throw new ForbiddenError(
        "Only administrators and moderators can update posts"
      );
    }
    // 1. Check if post exists
    const existingPost = await this.postRepository.findById(postId);
    if (!existingPost) {
      throw new NotFoundError("Post");
    }

    // 2. Update the post in the database
    const updatedPost = await this.postRepository.update(postId, updateData);

    logger.info("Post updated", { post_id: postId });

    // 3. Update Telegram messages if they exist
    const telegramMessages =
      await this.postRepository.getTelegramMessagesByPostId(postId);

    if (telegramMessages.length > 0) {
      this.telegramService.queueTask(async () => {
        try {
          for (const msg of telegramMessages) {
            const newMessageText = this.telegramService.buildPostMessageText({
              title: updatedPost.title,
              content: updatedPost.content,
              post_id: postId,
            });

            // Update text or caption depending on message type
            if (msg.is_media) {
              await this.telegramService.editMessageCaption({
                chatId: msg.chat_id,
                messageId: msg.message_id,
                caption: newMessageText,
                threadId: msg.thread_id,
              });
            } else {
              await this.telegramService.editMessageText({
                chatId: msg.chat_id,
                messageId: msg.message_id,
                text: newMessageText,
                threadId: msg.thread_id,
              });
            }
          }

          logger.info("Telegram messages updated for post", {
            post_id: postId,
          });
        } catch (error) {
          logger.error("Error updating Telegram messages for post", {
            post_id: postId,
            error: error.message,
          });
        }
      });
    }

    return updatedPost;
  }
}
