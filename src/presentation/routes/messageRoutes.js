import express from "express";
import MessageController from "../controllers/MessageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * All message routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/messages
 * @desc    Send a message
 * @access  Private
 */
router.post("/", MessageController.sendMessage);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get("/conversations", MessageController.getConversations);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get unread messages count
 * @access  Private
 */
router.get("/unread/count", MessageController.getUnreadCount);

/**
 * @route   GET /api/messages/thread/:threadId
 * @desc    Get message thread
 * @access  Private
 */
router.get("/thread/:threadId", MessageController.getThread);

/**
 * @route   GET /api/messages/:userId
 * @desc    Get messages between current user and another user
 * @access  Private
 */
router.get("/:userId", MessageController.getMessages);

/**
 * @route   PATCH /api/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.patch("/:messageId/read", MessageController.markAsRead);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete message (soft delete)
 * @access  Private
 */
router.delete("/:messageId", MessageController.deleteMessage);

export default router;
