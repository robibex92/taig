import express from "express";
import MessageController from "../controllers/MessageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

const BASE_PATH = "/messages";

/**
 * @route   GET /api/messages/:userId
 * @desc    Get messages between current user and another user
 * @access  Public (no auth required for viewing)
 */
router.get(`${BASE_PATH}/:userId`, MessageController.getMessages);

/**
 * @route   POST /api/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(BASE_PATH, authenticate, MessageController.sendMessage);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get(`${BASE_PATH}/conversations`, authenticate, MessageController.getConversations);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get unread messages count
 * @access  Private
 */
router.get(`${BASE_PATH}/unread/count`, authenticate, MessageController.getUnreadCount);

/**
 * @route   GET /api/messages/thread/:threadId
 * @desc    Get message thread
 * @access  Private
 */
router.get(`${BASE_PATH}/thread/:threadId`, authenticate, MessageController.getThread);

/**
 * @route   PATCH /api/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.patch(`${BASE_PATH}/:messageId/read`, authenticate, MessageController.markAsRead);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete message (soft delete)
 * @access  Private
 */
router.delete(`${BASE_PATH}/:messageId`, authenticate, MessageController.deleteMessage);

export default router;
