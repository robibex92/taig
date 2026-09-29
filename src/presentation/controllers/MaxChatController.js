import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

/**
 * Реестр MAX-чатов: список для выбора при публикации и CRUD для админки.
 *
 * Контроллер тонкий — решения принимают кейсы `application/use-cases/maxChat`.
 */
export class MaxChatController {
  constructor({
    getMaxChatsUseCase,
    createMaxChatUseCase,
    updateMaxChatUseCase,
    deleteMaxChatUseCase,
    lookupMaxChatUseCase,
  }) {
    this.getMaxChatsUseCase = getMaxChatsUseCase;
    this.createMaxChatUseCase = createMaxChatUseCase;
    this.updateMaxChatUseCase = updateMaxChatUseCase;
    this.deleteMaxChatUseCase = deleteMaxChatUseCase;
    this.lookupMaxChatUseCase = lookupMaxChatUseCase;
  }

  getChats = asyncHandler(async (req, res) => {
    const { purpose, active_only, visible_to_all_only } = req.query;

    const chats = await this.getMaxChatsUseCase.execute({
      purpose,
      active_only: active_only === "true",
      visible_to_all_only: visible_to_all_only === "true",
    });

    res.status(HTTP_STATUS.OK).json({ success: true, data: chats });
  });

  /**
   * Справка о чате по его id в MAX — перед тем как занести в реестр.
   * GET /api/max-chats/lookup/:chatId
   */
  lookupChat = asyncHandler(async (req, res) => {
    const chat = await this.lookupMaxChatUseCase.execute(req.params.chatId);

    res.status(HTTP_STATUS.OK).json({ success: true, data: chat });
  });

  createChat = asyncHandler(async (req, res) => {
    const chat = await this.createMaxChatUseCase.execute(req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: chat,
      message: "Чат MAX добавлен в реестр",
    });
  });

  updateChat = asyncHandler(async (req, res) => {
    const chat = await this.updateMaxChatUseCase.execute(req.params.id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: chat,
      message: "Запись о чате MAX обновлена",
    });
  });

  deleteChat = asyncHandler(async (req, res) => {
    await this.deleteMaxChatUseCase.execute(req.params.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Чат MAX удалён из реестра",
    });
  });
}
