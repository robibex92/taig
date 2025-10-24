import asyncHandler from "express-async-handler";
import SendMessageUseCase from "../../application/use-cases/message/SendMessageUseCase.js";
import GetMessagesUseCase from "../../application/use-cases/message/GetMessagesUseCase.js";
import GetConversationsUseCase from "../../application/use-cases/message/GetConversationsUseCase.js";
import MessageRepository from "../../infrastructure/repositories/MessageRepository.js";
import { ValidationError } from "../../domain/errors/index.js";

/**
 * MessageController - handles HTTP requests for messaging
 */
export class MessageController {
  constructor(
    sendMessageUseCase = SendMessageUseCase,
    getMessagesUseCase = GetMessagesUseCase,
    getConversationsUseCase = GetConversationsUseCase,
    messageRepository = MessageRepository
  ) {
    this.sendMessageUseCase = sendMessageUseCase;
    this.getMessagesUseCase = getMessagesUseCase;
    this.getConversationsUseCase = getConversationsUseCase;
    this.messageRepository = messageRepository;
  }

  /**
   * Send a message
   * POST /api/messages
   */
  sendMessage = asyncHandler(async (req, res) => {
    const { receiver_id, ad_id, content, parent_id } = req.body;
    const sender_id = req.user.user_id;

    if (!receiver_id) {
      throw new ValidationError("Receiver ID is required");
    }

    if (!content) {
      throw new ValidationError("Message content is required");
    }

    const result = await this.sendMessageUseCase.execute({
      senderId: sender_id,
      receiverId: receiver_id,
      adId: ad_id,
      content,
      parentId: parent_id,
    });

    res.status(201).json(result);
  });

  /**
   * Get messages between current user and another user
   * GET /api/messages/:userId
   */
  getMessages = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.user_id;
    const { ad_id, limit = 50, offset = 0, mark_as_read = "false" } = req.query;

    console.log('MessageController.getMessages called with:', {
      userId,
      currentUserId,
      query: req.query,
      ad_id,
      mark_as_read
    });

    const result = await this.getMessagesUseCase.execute({
      currentUserId,
      otherUserId: userId,
      adId: ad_id,
      limit: parseInt(limit),
      offset: parseInt(offset),
      markAsRead: mark_as_read === "true",
    });

    res.json(result);
  });

  /**
   * Get user's conversations
   * GET /api/messages/conversations
   */
  getConversations = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await this.getConversationsUseCase.execute({
      userId,
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeLastMessage: true,
    });

    res.json(result);
  });

  /**
   * Mark message as read
   * PATCH /api/messages/:messageId/read
   */
  markAsRead = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    // Find message and verify user is the receiver
    const message = await this.messageRepository.findById(messageId);

    if (!message) {
      throw new ValidationError("Message not found");
    }

    if (message.receiver_id?.toString() !== userId.toString()) {
      throw new ValidationError("You can only mark your own messages as read");
    }

    const updatedMessage = await this.messageRepository.markAsRead(messageId);

    res.json({ message: updatedMessage.toJSON() });
  });

  /**
   * Get unread messages count
   * GET /api/messages/unread/count
   */
  getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    const count = await this.messageRepository.getUnreadCount(userId);

    res.json({ unread_count: count });
  });

  /**
   * Get message thread
   * GET /api/messages/thread/:threadId
   */
  getThread = asyncHandler(async (req, res) => {
    const { threadId } = req.params;

    const messages = await this.messageRepository.getThread(threadId);

    res.json({ messages: messages.map((m) => m.toJSON()) });
  });

  /**
   * Delete message (soft delete)
   * DELETE /api/messages/:messageId
   */
  deleteMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    // Find message and verify user is the sender
    const message = await this.messageRepository.findById(messageId);

    if (!message) {
      throw new ValidationError("Message not found");
    }

    if (message.sender_id?.toString() !== userId.toString()) {
      throw new ValidationError("You can only delete your own messages");
    }

    await this.messageRepository.softDelete(messageId);

    res.json({ success: true, message: "Message deleted" });
  });
}

export default new MessageController();
