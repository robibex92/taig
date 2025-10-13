import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

/**
 * TelegramChatController
 * Handles HTTP requests for Telegram chat management
 */
export class TelegramChatController {
  constructor(
    getTelegramChatsUseCase,
    createTelegramChatUseCase,
    updateTelegramChatUseCase,
    deleteTelegramChatUseCase,
    toggleTelegramChatActiveUseCase
  ) {
    this.getTelegramChatsUseCase = getTelegramChatsUseCase;
    this.createTelegramChatUseCase = createTelegramChatUseCase;
    this.updateTelegramChatUseCase = updateTelegramChatUseCase;
    this.deleteTelegramChatUseCase = deleteTelegramChatUseCase;
    this.toggleTelegramChatActiveUseCase = toggleTelegramChatActiveUseCase;
  }

  /**
   * Get all Telegram chats
   */
  getChats = asyncHandler(async (req, res) => {
    const { purpose, active_only, visible_to_all_only } = req.query;
    const chats = await this.getTelegramChatsUseCase.execute({
      purpose,
      active_only: active_only === "true",
      visible_to_all_only: visible_to_all_only === "true",
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: chats,
    });
  });

  /**
   * Create new Telegram chat
   */
  createChat = asyncHandler(async (req, res) => {
    const chat = await this.createTelegramChatUseCase.execute(req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: chat,
      message: "Telegram chat created successfully",
    });
  });

  /**
   * Update Telegram chat
   */
  updateChat = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const chat = await this.updateTelegramChatUseCase.execute(id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: chat,
      message: "Telegram chat updated successfully",
    });
  });

  /**
   * Delete Telegram chat
   */
  deleteChat = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await this.deleteTelegramChatUseCase.execute(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Telegram chat deleted successfully",
    });
  });

  /**
   * Toggle chat active status
   */
  toggleActive = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const chat = await this.toggleTelegramChatActiveUseCase.execute(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: chat,
      message: `Telegram chat ${
        chat.is_active ? "activated" : "deactivated"
      } successfully`,
    });
  });
}
