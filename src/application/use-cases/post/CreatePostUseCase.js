import { logger } from "../../../core/utils/logger.js";
import { ForbiddenError } from "../../../domain/errors/index.js";

/**
 * Use case for creating a new post
 */
export class CreatePostUseCase {
  constructor(postRepository, telegramService, telegramChatRepository) {
    this.postRepository = postRepository;
    this.telegramService = telegramService;
    this.telegramChatRepository = telegramChatRepository;
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
          const internalChatIds = selectedChats.map((c) =>
            typeof c === "object" ? c.chatId : c
          );

          // Fetch the actual chat details from the database
          const chatDetails = await this.telegramChatRepository.findByIds(
            internalChatIds
          );

          if (!chatDetails || chatDetails.length === 0) {
            logger.warn("No valid Telegram chats found for the selected IDs", {
              selected: internalChatIds,
            });
            return;
          }

          // Map internal IDs to actual Telegram chat_id and thread_id
          const chatMap = new Map(
            chatDetails.map((chat) => [chat.id.toString(), chat])
          );

          const chatIds = [];
          const threadIds = [];

          for (const selected of selectedChats) {
            const internalId =
              typeof selected === "object" ? selected.chatId : selected;
            const chat = chatMap.get(internalId.toString());

            if (chat && chat.chat_id) {
              chatIds.push(chat.chat_id);
              // Use the threadId from the original selection if it exists, otherwise from the DB
              threadIds.push(
                selected.threadId !== undefined
                  ? selected.threadId
                  : chat.thread_id || null
              );
            } else {
              logger.warn(`Chat with internal ID ${internalId} not found or is missing a Telegram chat_id`);
            }
          }

          if (chatIds.length === 0) {
            logger.warn("No chats to send to after filtering.", {
              selected: internalChatIds,
            });
            return;
          }

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
