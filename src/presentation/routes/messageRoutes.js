import express from "express";
import MessageController from "../controllers/MessageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * All message routes require authentication
 */
router.use(authenticate);

const BASE_PATH = "/messages";

/**
 * @route   POST /api/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(BASE_PATH, MessageController.sendMessage);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get(`${BASE_PATH}/conversations`, MessageController.getConversations);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get unread messages count
 * @access  Private
 */
router.get(`${BASE_PATH}/unread/count`, MessageController.getUnreadCount);

/**
 * @route   GET /api/messages/thread/:threadId
 * @desc    Get message thread
 * @access  Private
 */
router.get(`${BASE_PATH}/thread/:threadId`, MessageController.getThread);

/**
 * @route   PATCH /api/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.patch(`${BASE_PATH}/:messageId/read`, MessageController.markAsRead);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete message (soft delete)
 * @access  Private
 */
router.delete(`${BASE_PATH}/:messageId`, MessageController.deleteMessage);

/**
 * @route   GET /api/messages/:userId
 * @desc    Get messages between current user and another user
 * @access  Private
 */
router.get(`${BASE_PATH}/:userId`, MessageController.getMessages);

export default router;
