import { logger } from "../../../core/utils/logger.js";
import { ForbiddenError } from "../../../domain/errors/index.js";

/**
 * Use case for creating a new post
 */
export class CreatePostUseCase {
  constructor(postRepository, telegramService) {
    this.postRepository = postRepository;
    this.telegramService = telegramService;
  }

  async execute(postData, isImportant, selectedChats, photos, user) {
    // Authorization: Only admins and moderators can create posts
    if (!user || (user.status !== "admin" && user.status !== "moderator")) {
      logger.warn("Unauthorized attempt to create post", {
        userId: user?.user_id,
        status: user?.status,
      });
      throw new ForbiddenError(
        "Only administrators and moderators can create posts"
      );
    }
    const { title, content, image_url, status, source, marker } = postData;

    // 1. Create the post in the database
    const newPost = await this.postRepository.create({
      title,
      content,
      image_url,
      status: status || "active",
      source,
      marker,
    });

    logger.info("Post created", { post_id: newPost.id, title });

    // 2. Send to Telegram if important and chats selected
    if (isImportant && selectedChats && selectedChats.length > 0) {
      const messageText = this.telegramService.buildPostMessageText({
        title,
        content,
        post_id: newPost.id,
      });

      // Prepare photos
      const photosToSend =
        photos && photos.length > 0 ? photos : image_url ? [image_url] : [];

      // Queue Telegram sending task
      this.telegramService.queueTask(async () => {
        try {
          const chatIds = selectedChats.map((c) =>
            typeof c === "object" ? c.chatId : c
          );
          const threadIds = selectedChats.map((c) =>
            typeof c === "object" ? c.threadId : null
          );

          const result = await this.telegramService.sendMessage({
            message: `🚨 ${title} 🚨\n🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n${content}`,
            chatIds,
            threadIds,
            photos: photosToSend,
          });

          // Save message IDs to database
          if (result && Array.isArray(result.results)) {
            for (const res of result.results) {
              if (res.success && res.result) {
                // Handle array of messages (e.g., media group or single)
                const messages = Array.isArray(res.result)
                  ? res.result
                  : [res.result];

                for (const msg of messages) {
                  if (msg && msg.message_id) {
                    await this.postRepository.saveTelegramMessage(
                      newPost.id,
                      res.chatId,
                      res.threadId || null,
                      msg.message_id,
                      `🚨 ${title} 🚨\n🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n${content}`,
                      photosToSend.length > 0,
                      msg.media_group_id || null
                    );

                    logger.debug("Telegram message saved", {
                      post_id: newPost.id,
                      message_id: msg.message_id,
                    });
                  }
                }
              }
            }
          }

          logger.info("Post sent to Telegram", { post_id: newPost.id });
        } catch (error) {
          logger.error("Error sending post to Telegram", {
            post_id: newPost.id,
            error: error.message,
          });
        }
      });
    }

    return newPost;
  }
}
