// Repositories
import { AdRepository } from "../repositories/AdRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { PostRepository } from "../repositories/PostRepository.js";
import { CategoryRepository } from "../repositories/CategoryRepository.js";
import { FaqRepository } from "../repositories/FaqRepository.js";
import { FloorRuleRepository } from "../repositories/FloorRuleRepository.js";
import { CarRepository } from "../repositories/CarRepository.js";
import { CarImageRepository } from "../repositories/CarImageRepository.js";
import { CarAdminNoteRepository } from "../repositories/CarAdminNoteRepository.js";
import { AdImageRepository } from "../repositories/AdImageRepository.js";
import { HouseRepository } from "../repositories/HouseRepository.js";
import { RefreshTokenRepository } from "../repositories/RefreshTokenRepository.js";
import { TelegramChatRepository } from "../repositories/TelegramChatRepository.js";
import { HouseCommentRepository } from "../repositories/HouseCommentRepository.js";
import { EntranceCommentRepository } from "../repositories/EntranceCommentRepository.js";
import { AuthHandoffRepository } from "../repositories/AuthHandoffRepository.js";

// Services
import { TokenService } from "../../application/services/TokenService.improved.js";
import { SessionIssuer } from "../../application/services/SessionIssuer.js";
import { telegramService } from "../../application/services/TelegramService.js";
import { messageDeliveryService } from "../../application/services/MessageDeliveryService.js";
import { FileUploadService } from "../../application/services/FileUploadService.js";
import { CarImageUploadService } from "../../application/services/CarImageUploadService.js";

// Services - MAX Bot (инфраструктурный HTTP-клиент + сборщик входящих)
import { maxBotService } from "../services/MaxBotService.js";
import { MaxChatRepository } from "../repositories/MaxChatRepository.js";
import { MaxBotUpdatePoller } from "../services/MaxBotUpdatePoller.js";

// Use Cases - Ad
import { GetAdsUseCase } from "../../application/use-cases/ad/GetAdsUseCase.js";
import { GetAdByIdUseCase } from "../../application/use-cases/ad/GetAdByIdUseCase.js";
import { CreateAdUseCase } from "../../application/use-cases/ad/CreateAdUseCase.js";
import { UpdateAdUseCase } from "../../application/use-cases/ad/UpdateAdUseCase.js";
import { DeleteAdUseCase } from "../../application/use-cases/ad/DeleteAdUseCase.js";
import { MarkAdRelevantUseCase } from "../../application/use-cases/ad/MarkAdRelevantUseCase.js";
import { ArchiveOldAdsUseCase } from "../../application/use-cases/ad/ArchiveOldAdsUseCase.js";

// Use Cases - User
import { AuthenticateUserUseCase } from "../../application/use-cases/user/AuthenticateUserUseCase.improved.js";
import {
  GetMaxChatsUseCase,
  CreateMaxChatUseCase,
  UpdateMaxChatUseCase,
  DeleteMaxChatUseCase,
  LookupMaxChatUseCase,
} from "../../application/use-cases/maxChat/MaxChatAdminUseCases.js";
import { MaxChatController } from "../../presentation/controllers/MaxChatController.js";
import { AuthenticateTelegramWebAppUseCase } from "../../application/use-cases/user/AuthenticateTelegramWebAppUseCase.js";
import { LoginHandoffUseCase } from "../../application/use-cases/user/LoginHandoffUseCase.js";
import { RefreshTokenUseCase } from "../../application/use-cases/user/RefreshTokenUseCase.improved.js";
import { UpdateUserUseCase } from "../../application/use-cases/user/UpdateUserUseCase.js";
import { UploadAvatarUseCase } from "../../application/use-cases/user/UploadAvatarUseCase.js";
import { LogoutUseCase } from "../../application/use-cases/user/LogoutUseCase.js";
import { AuthenticateMaxUserUseCase } from "../../application/use-cases/user/AuthenticateMaxUserUseCase.js";
import { LinkPlatformUseCase } from "../../application/use-cases/user/LinkPlatformUseCase.js";

// Use Cases - MAX Bot (админка: рассылки и входящие обращения)
import { MaxBotAdminUseCases } from "../../application/use-cases/maxBot/MaxBotAdminUseCases.js";
import { MaxBotBroadcastUseCases } from "../../application/use-cases/maxBot/MaxBotBroadcastUseCases.js";

// Use Cases - Session
import { GetUserSessionsUseCase } from "../../application/use-cases/session/GetUserSessionsUseCase.js";
import { RevokeSessionUseCase } from "../../application/use-cases/session/RevokeSessionUseCase.js";
import { RevokeAllSessionsUseCase } from "../../application/use-cases/session/RevokeAllSessionsUseCase.js";

// Use Cases - Post
import { GetPostsUseCase } from "../../application/use-cases/post/GetPostsUseCase.js";
import { CreatePostUseCase } from "../../application/use-cases/post/CreatePostUseCase.js";
import { UpdatePostUseCase } from "../../application/use-cases/post/UpdatePostUseCase.js";
import { DeletePostUseCase } from "../../application/use-cases/post/DeletePostUseCase.js";

// Use Cases - Category
import { GetCategoriesUseCase } from "../../application/use-cases/category/GetCategoriesUseCase.js";
import { GetCategoryByIdUseCase } from "../../application/use-cases/category/GetCategoryByIdUseCase.js";
import { GetSubcategoriesUseCase } from "../../application/use-cases/category/GetSubcategoriesUseCase.js";
import { GetAllSubcategoriesUseCase } from "../../application/use-cases/category/GetAllSubcategoriesUseCase.js";
import { GetSubcategoryByIdUseCase } from "../../application/use-cases/category/GetSubcategoryByIdUseCase.js";
import { GetCategoriesWithCountsUseCase } from "../../application/use-cases/category/GetCategoriesWithCountsUseCase.js";
import { GetSubcategoriesWithCountsUseCase } from "../../application/use-cases/category/GetSubcategoriesWithCountsUseCase.js";

// Use Cases - House Comments
import { CreateHouseCommentUseCase } from "../../application/use-cases/houseComment/CreateHouseCommentUseCase.js";
import { GetHouseCommentsUseCase } from "../../application/use-cases/houseComment/GetHouseCommentsUseCase.js";
import { UpdateHouseCommentUseCase } from "../../application/use-cases/houseComment/UpdateHouseCommentUseCase.js";
import { DeleteHouseCommentUseCase } from "../../application/use-cases/houseComment/DeleteHouseCommentUseCase.js";

// Use Cases - Entrance Comments
import { CreateEntranceCommentUseCase } from "../../application/use-cases/entranceComment/CreateEntranceCommentUseCase.js";
import { GetEntranceCommentUseCase } from "../../application/use-cases/entranceComment/GetEntranceCommentUseCase.js";
import { UpdateEntranceCommentUseCase } from "../../application/use-cases/entranceComment/UpdateEntranceCommentUseCase.js";
import { DeleteEntranceCommentUseCase } from "../../application/use-cases/entranceComment/DeleteEntranceCommentUseCase.js";

// Use Cases - FAQ
import { GetFaqsUseCase } from "../../application/use-cases/faq/GetFaqsUseCase.js";
import { CreateFaqUseCase } from "../../application/use-cases/faq/CreateFaqUseCase.js";
import { UpdateFaqUseCase } from "../../application/use-cases/faq/UpdateFaqUseCase.js";
import { DeleteFaqUseCase } from "../../application/use-cases/faq/DeleteFaqUseCase.js";

// Use Cases - FloorRule
import { GetFloorRulesUseCase } from "../../application/use-cases/floorRule/GetFloorRulesUseCase.js";
import { UpsertFloorRuleUseCase } from "../../application/use-cases/floorRule/UpsertFloorRuleUseCase.js";
import { SetFloorOffsetsUseCase } from "../../application/use-cases/floorRule/SetFloorOffsetsUseCase.js";

// Use Cases - Car
import { GetCarsUseCase } from "../../application/use-cases/car/GetCarsUseCase.js";
import { GetUserCarsUseCase } from "../../application/use-cases/car/GetUserCarsUseCase.js";
import { GetCarByIdUseCase } from "../../application/use-cases/car/GetCarByIdUseCase.js";
import { CreateCarUseCase } from "../../application/use-cases/car/CreateCarUseCase.js";
import { UpdateCarUseCase } from "../../application/use-cases/car/UpdateCarUseCase.js";
import { DeleteCarUseCase } from "../../application/use-cases/car/DeleteCarUseCase.js";

// Use Cases - Car Images
import { GetCarImagesUseCase } from "../../application/use-cases/GetCarImagesUseCase.js";
import { AddCarImageUseCase } from "../../application/use-cases/AddCarImageUseCase.js";
import { UpdateCarImageUseCase } from "../../application/use-cases/UpdateCarImageUseCase.js";
import { DeleteCarImageUseCase } from "../../application/use-cases/DeleteCarImageUseCase.js";

// Use Cases - Car Admin Notes
import { GetCarAdminNotesUseCase } from "../../application/use-cases/GetCarAdminNotesUseCase.js";
import { AddCarAdminNoteUseCase } from "../../application/use-cases/AddCarAdminNoteUseCase.js";
import { UpdateCarAdminNoteUseCase } from "../../application/use-cases/UpdateCarAdminNoteUseCase.js";
import { DeleteCarAdminNoteUseCase } from "../../application/use-cases/DeleteCarAdminNoteUseCase.js";

// Use Cases - Car Management
import { MergeCarsUseCase } from "../../application/use-cases/MergeCarsUseCase.js";
import { AssignCarToUserUseCase } from "../../application/use-cases/AssignCarToUserUseCase.js";

// Use Cases - AdImage
import { CreateAdImagesUseCase } from "../../application/use-cases/adImage/CreateAdImagesUseCase.js";
import { GetAdImagesUseCase } from "../../application/use-cases/adImage/GetAdImagesUseCase.js";
import { GetImagesByIdUseCase } from "../../application/use-cases/adImage/GetImagesByIdUseCase.js";
import { DeleteAdImageUseCase } from "../../application/use-cases/adImage/DeleteAdImageUseCase.js";
import { DeleteMultipleAdImagesUseCase } from "../../application/use-cases/adImage/DeleteMultipleAdImagesUseCase.js";
import { SetMainImageUseCase } from "../../application/use-cases/adImage/SetMainImageUseCase.js";

// Use Cases - House
import { GetUniqueHousesUseCase } from "../../application/use-cases/house/GetUniqueHousesUseCase.js";
import { GetEntrancesByHouseUseCase } from "../../application/use-cases/house/GetEntrancesByHouseUseCase.js";
import { GetHousesByFilterUseCase } from "../../application/use-cases/house/GetHousesByFilterUseCase.js";
import { GetUserHousesUseCase } from "../../application/use-cases/house/GetUserHousesUseCase.js";
import { GetHouseInfoUseCase } from "../../application/use-cases/house/GetHouseInfoUseCase.js";
import { LinkUserToApartmentUseCase } from "../../application/use-cases/house/LinkUserToApartmentUseCase.js";
import { UnlinkUserFromApartmentUseCase } from "../../application/use-cases/house/UnlinkUserFromApartmentUseCase.js";
import { UpdateHouseInfoUseCase } from "../../application/use-cases/house/UpdateHouseInfoUseCase.js";
import { UpdateApartmentLayoutUseCase } from "../../application/use-cases/house/UpdateApartmentLayoutUseCase.js";

// Use Cases - TelegramChat
import { GetTelegramChatsUseCase } from "../../application/use-cases/telegramChat/GetTelegramChatsUseCase.js";
import { CreateTelegramChatUseCase } from "../../application/use-cases/telegramChat/CreateTelegramChatUseCase.js";
import { UpdateTelegramChatUseCase } from "../../application/use-cases/telegramChat/UpdateTelegramChatUseCase.js";
import { DeleteTelegramChatUseCase } from "../../application/use-cases/telegramChat/DeleteTelegramChatUseCase.js";
import { ToggleTelegramChatActiveUseCase } from "../../application/use-cases/telegramChat/ToggleTelegramChatActiveUseCase.js";

// Use Cases - Admin
import { GetAllUsersUseCase } from "../../application/use-cases/admin/GetAllUsersUseCase.js";
import { UpdateUserRolesUseCase } from "../../application/use-cases/admin/UpdateUserRolesUseCase.js";
import { GetStatisticsUseCase } from "../../application/use-cases/admin/GetStatisticsUseCase.js";
import { GetRoleCatalogUseCase } from "../../application/use-cases/admin/GetRoleCatalogUseCase.js";

// Controllers
import { AdController } from "../../presentation/controllers/AdController.js";
import { AuthController } from "../../presentation/controllers/AuthController.improved.js";
import { UserController } from "../../presentation/controllers/UserController.js";
import { PostController } from "../../presentation/controllers/PostController.js";
import { CategoryController } from "../../presentation/controllers/CategoryController.js";
import { FaqController } from "../../presentation/controllers/FaqController.js";
import { FloorRuleController } from "../../presentation/controllers/FloorRuleController.js";
import { CarController } from "../../presentation/controllers/CarController.js";
import { AdImageController } from "../../presentation/controllers/AdImageController.js";
import { UploadController } from "../../presentation/controllers/UploadController.js";
import { HouseController } from "../../presentation/controllers/HouseController.js";
import { TelegramChatController } from "../../presentation/controllers/TelegramChatController.js";
import { AdminController } from "../../presentation/controllers/AdminController.js";
import { EventController } from "../../presentation/controllers/EventController.js";
import { ParkingController } from "../../presentation/controllers/ParkingController.js";
import { MaxBotController } from "../../presentation/controllers/MaxBotController.js";

// Real Use Cases for Events
import { GetEventsUseCase } from "../../application/use-cases/event/GetEventsUseCase.js";
import { GetEventByIdUseCase } from "../../application/use-cases/event/GetEventByIdUseCase.js";
import { CreateEventUseCase } from "../../application/use-cases/event/CreateEventUseCase.js";
import { UpdateEventUseCase } from "../../application/use-cases/event/UpdateEventUseCase.js";
import { DeleteEventUseCase } from "../../application/use-cases/event/DeleteEventUseCase.js";
import { RegisterForEventUseCase } from "../../application/use-cases/event/RegisterForEventUseCase.js";
import { UnregisterFromEventUseCase } from "../../application/use-cases/event/UnregisterFromEventUseCase.js";

import { ParkingUseCases } from "../../application/use-cases/parking/ParkingUseCases.js";
import { GetSpotNotesUseCase } from "../../application/use-cases/parking/GetSpotNotesUseCase.js";
import { AddSpotNoteUseCase } from "../../application/use-cases/parking/AddSpotNoteUseCase.js";
import { DeleteSpotNoteUseCase } from "../../application/use-cases/parking/DeleteSpotNoteUseCase.js";
import { ParkingSpotNoteRepository } from "../repositories/ParkingSpotNoteRepository.js";

/**
 * Dependency Injection Container
 * Manages application dependencies and their lifecycle
 */
export class Container {
  constructor() {
    this.dependencies = new Map();
    this.setupDependencies();
  }

  /**
   * Register a dependency
   */
  register(name, factory, singleton = true) {
    this.dependencies.set(name, { factory, singleton, instance: null });
  }

  /**
   * Resolve a dependency
   */
  resolve(name) {
    const dependency = this.dependencies.get(name);

    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }

    if (dependency.singleton && dependency.instance) {
      return dependency.instance;
    }

    const instance = dependency.factory(this);

    if (dependency.singleton) {
      dependency.instance = instance;
    }

    return instance;
  }

  /**
   * Пачка зависимостей по именам — для контроллеров с объектным конструктором.
   * Порядок строк в списке больше не может молча подменить один кейс другим.
   */
  resolveAll(...names) {
    return Object.fromEntries(names.map((name) => [name, this.resolve(name)]));
  }

  /**
   * Пачка однотипных регистраций: «экземпляр класса с перечисленными
   * зависимостями». Порядок аргументов стоит рядом с именем регистрации, а не
   * тонет в семи строках переносов — ради этого весь файл и сворачивался.
   */
  registerMany(entries) {
    for (const [name, Factory, dependencies = []] of entries) {
      this.register(name, (container) =>
        new Factory(...dependencies.map((dep) => container.resolve(dep)))
      );
    }
  }

  /**
   * Setup all dependencies
   */
  setupDependencies() {
    // Repositories
    this.registerMany([
      ["adRepository", AdRepository, []],
      ["userRepository", UserRepository, []],
      ["postRepository", PostRepository, []],
      ["categoryRepository", CategoryRepository, []],
      ["faqRepository", FaqRepository, []],
      ["floorRuleRepository", FloorRuleRepository, []],
      ["carRepository", CarRepository, []],
      ["carImageRepository", CarImageRepository, []],
      ["carAdminNoteRepository", CarAdminNoteRepository, []],
      ["parkingSpotNoteRepository", ParkingSpotNoteRepository, []],
      ["adImageRepository", AdImageRepository, []],
      ["houseRepository", HouseRepository, []],
      ["refreshTokenRepository", RefreshTokenRepository, []],
      ["telegramChatRepository", TelegramChatRepository, []],
      // Реестр MAX-чатов (K4): по той же схеме, что telegram_chats.
      ["maxChatRepository", MaxChatRepository, []],
      ["houseCommentRepository", HouseCommentRepository, []],
      ["entranceCommentRepository", EntranceCommentRepository, []],
      ["authHandoffRepository", AuthHandoffRepository, []],
    ]);

    // Services
    this.registerMany([
      ["tokenService", TokenService, []],
    ]);

    // Экземпляр из модуля, а не new: очередь pLimit и пауза 2с защищают один токен бота,
    // поэтому инстанс должен быть ровно один на процесс.
    this.register("telegramService", () => telegramService);
    this.registerMany([
      ["fileUploadService", FileUploadService, []],
      ["carImageUploadService", CarImageUploadService, []],
    ]);

    // Один экземпляр: резолвер получателя + общий rate-limiter TelegramService.
    this.register("messageDeliveryService", () => messageDeliveryService);

    // Use Cases - Ad
    this.registerMany([
      ["getAdsUseCase", GetAdsUseCase, ["adRepository"]],
      ["getAdByIdUseCase", GetAdByIdUseCase, ["adRepository"]],
      ["createAdUseCase", CreateAdUseCase, ["adRepository", "userRepository", "telegramChatRepository", "telegramService", "maxChatRepository", "maxBotService"]],
      ["updateAdUseCase", UpdateAdUseCase, ["adRepository", "telegramService", "telegramChatRepository", "maxBotService", "maxChatRepository"]],
      ["deleteAdUseCase", DeleteAdUseCase, ["adRepository", "telegramService"]],
      ["markAdRelevantUseCase", MarkAdRelevantUseCase, ["adRepository"]],
      // Авто-архив: дёргается крон-задачей из server.js, не через HTTP в самого себя.
      ["archiveOldAdsUseCase", ArchiveOldAdsUseCase, ["adRepository"]],
    ]);

    // Use Cases - User
    this.registerMany([
      // Один SessionIssuer на все способы войти: Telegram, MAX и rotation.
      ["sessionIssuer", SessionIssuer, ["tokenService", "refreshTokenRepository"]],
      ["authenticateUserUseCase", AuthenticateUserUseCase, ["userRepository", "sessionIssuer"]],
      // Вход из Telegram Mini App: подпись `tgWebAppData`, проверка токеном этого бота.
      [
        "authenticateTelegramWebAppUseCase",
        AuthenticateTelegramWebAppUseCase,
        ["authenticateUserUseCase", "sessionIssuer", "authHandoffRepository"],
      ],
      // Вход из Telegram-бота в браузер (`/start login_…` → claim), схема как у MAX.
      ["loginHandoffUseCase", LoginHandoffUseCase, ["userRepository", "authenticateUserUseCase", "sessionIssuer", "authHandoffRepository"]],
      ["refreshTokenUseCase", RefreshTokenUseCase, ["userRepository", "tokenService", "refreshTokenRepository", "sessionIssuer"]],
      ["updateUserUseCase", UpdateUserUseCase, ["userRepository"]],
      ["uploadAvatarUseCase", UploadAvatarUseCase, ["userRepository"]],
      ["logoutUseCase", LogoutUseCase, ["refreshTokenRepository", "tokenService"]],
    ]);

    // Use Cases - MAX
    this.registerMany([
      ["authenticateMaxUserUseCase", AuthenticateMaxUserUseCase, ["userRepository", "sessionIssuer", "authHandoffRepository"]],
      ["linkPlatformUseCase", LinkPlatformUseCase, ["userRepository", "authenticateUserUseCase", "authenticateMaxUserUseCase"]],
    ]);

    // Use Cases - Session
    this.registerMany([
      ["getUserSessionsUseCase", GetUserSessionsUseCase, ["refreshTokenRepository", "tokenService"]],
      ["revokeSessionUseCase", RevokeSessionUseCase, ["refreshTokenRepository"]],
      ["revokeAllSessionsUseCase", RevokeAllSessionsUseCase, ["refreshTokenRepository"]],
    ]);

    // Use Cases - Post
    this.registerMany([
      ["getPostsUseCase", GetPostsUseCase, ["postRepository"]],
      ["createPostUseCase", CreatePostUseCase, ["postRepository", "telegramService", "telegramChatRepository"]],
      ["updatePostUseCase", UpdatePostUseCase, ["postRepository", "telegramService"]],
      ["deletePostUseCase", DeletePostUseCase, ["postRepository", "telegramService"]],
    ]);

    // Controllers
    this.register(
      "adController",
      (container) =>
        new AdController(
          container.resolveAll(
            "getAdsUseCase",
            "getAdByIdUseCase",
            "createAdUseCase",
            "updateAdUseCase",
            "deleteAdUseCase",
            "markAdRelevantUseCase",
            "adRepository",
            "telegramService"
          )
        )
    );
    this.register(
      "authController",
      (container) =>
        new AuthController(
          container.resolveAll(
            "authenticateUserUseCase",
            "refreshTokenUseCase",
            "logoutUseCase",
            "getUserSessionsUseCase",
            "revokeSessionUseCase",
            "revokeAllSessionsUseCase",
            "userRepository",
            "tokenService",
            "authenticateMaxUserUseCase",
            "authenticateTelegramWebAppUseCase",
            "linkPlatformUseCase",
            "loginHandoffUseCase"
          )
        )
    );

    this.registerMany([
      ["userController", UserController, ["updateUserUseCase", "userRepository", "adRepository", "uploadAvatarUseCase"]],
      ["postController", PostController, ["getPostsUseCase", "createPostUseCase", "updatePostUseCase", "deletePostUseCase"]],
    ]);

    // Use Cases - Category
    this.registerMany([
      ["getCategoriesUseCase", GetCategoriesUseCase, ["categoryRepository"]],
      ["getCategoryByIdUseCase", GetCategoryByIdUseCase, ["categoryRepository"]],
      ["getSubcategoriesUseCase", GetSubcategoriesUseCase, ["categoryRepository"]],
      ["getAllSubcategoriesUseCase", GetAllSubcategoriesUseCase, ["categoryRepository"]],
      ["getSubcategoryByIdUseCase", GetSubcategoryByIdUseCase, ["categoryRepository"]],
      ["getCategoriesWithCountsUseCase", GetCategoriesWithCountsUseCase, ["categoryRepository"]],
      ["getSubcategoriesWithCountsUseCase", GetSubcategoriesWithCountsUseCase, ["categoryRepository"]],
    ]);

    // Use Cases - House Comments
    this.registerMany([
      ["createHouseCommentUseCase", CreateHouseCommentUseCase, ["houseCommentRepository"]],
      ["getHouseCommentsUseCase", GetHouseCommentsUseCase, ["houseCommentRepository"]],
      ["updateHouseCommentUseCase", UpdateHouseCommentUseCase, ["houseCommentRepository"]],
      ["deleteHouseCommentUseCase", DeleteHouseCommentUseCase, ["houseCommentRepository"]],
    ]);

    // Use Cases - Entrance Comments
    this.registerMany([
      ["createEntranceCommentUseCase", CreateEntranceCommentUseCase, ["entranceCommentRepository", "houseRepository"]],
      ["getEntranceCommentUseCase", GetEntranceCommentUseCase, ["entranceCommentRepository", "houseRepository"]],
      ["updateEntranceCommentUseCase", UpdateEntranceCommentUseCase, ["entranceCommentRepository"]],
      ["deleteEntranceCommentUseCase", DeleteEntranceCommentUseCase, ["entranceCommentRepository"]],
    ]);

    // Controllers - Category
    this.registerMany([
      ["categoryController", CategoryController, ["getCategoriesUseCase", "getCategoryByIdUseCase", "getSubcategoriesUseCase", "getAllSubcategoriesUseCase", "getSubcategoryByIdUseCase", "getCategoriesWithCountsUseCase", "getSubcategoriesWithCountsUseCase"]],
    ]);

    // Use Cases - FAQ
    this.registerMany([
      ["getFaqsUseCase", GetFaqsUseCase, ["faqRepository"]],
      ["createFaqUseCase", CreateFaqUseCase, ["faqRepository"]],
      ["updateFaqUseCase", UpdateFaqUseCase, ["faqRepository"]],
      ["deleteFaqUseCase", DeleteFaqUseCase, ["faqRepository"]],
    ]);

    // Controllers - FAQ
    this.registerMany([
      ["faqController", FaqController, ["getFaqsUseCase", "createFaqUseCase", "updateFaqUseCase", "deleteFaqUseCase"]],
    ]);

    // Use Cases - FloorRule
    this.registerMany([
      ["getFloorRulesUseCase", GetFloorRulesUseCase, ["floorRuleRepository"]],
      ["upsertFloorRuleUseCase", UpsertFloorRuleUseCase, ["floorRuleRepository"]],
      ["setFloorOffsetsUseCase", SetFloorOffsetsUseCase, ["floorRuleRepository"]],
    ]);

    // Controllers - FloorRule
    this.register(
      "floorRuleController",
      (container) =>
        new FloorRuleController(
          container.resolveAll(
            "getFloorRulesUseCase",
            "upsertFloorRuleUseCase",
            "setFloorOffsetsUseCase"
          )
        )
    );

    // Use Cases - Car
    this.registerMany([
      ["getCarsUseCase", GetCarsUseCase, ["carRepository"]],
      ["getUserCarsUseCase", GetUserCarsUseCase, ["carRepository"]],
      ["getCarByIdUseCase", GetCarByIdUseCase, ["carRepository"]],
      ["createCarUseCase", CreateCarUseCase, ["carRepository"]],
      ["updateCarUseCase", UpdateCarUseCase, ["carRepository"]],
      ["deleteCarUseCase", DeleteCarUseCase, ["carRepository"]],
    ]);

    // Use Cases - Car Images
    this.registerMany([
      ["getCarImagesUseCase", GetCarImagesUseCase, ["carImageRepository", "carRepository"]],
      ["addCarImageUseCase", AddCarImageUseCase, ["carImageRepository", "carRepository"]],
      ["updateCarImageUseCase", UpdateCarImageUseCase, ["carImageRepository"]],
      ["deleteCarImageUseCase", DeleteCarImageUseCase, ["carImageRepository"]],
    ]);

    // Use Cases - Car Admin Notes
    this.registerMany([
      ["getCarAdminNotesUseCase", GetCarAdminNotesUseCase, ["carAdminNoteRepository", "carRepository", "userRepository"]],
      ["addCarAdminNoteUseCase", AddCarAdminNoteUseCase, ["carAdminNoteRepository", "carRepository"]],
      ["updateCarAdminNoteUseCase", UpdateCarAdminNoteUseCase, ["carAdminNoteRepository"]],
      ["deleteCarAdminNoteUseCase", DeleteCarAdminNoteUseCase, ["carAdminNoteRepository"]],
    ]);

    // Use Cases - Car Management
    this.registerMany([
      ["mergeCarsUseCase", MergeCarsUseCase, ["carRepository", "carImageRepository", "carAdminNoteRepository"]],
      ["assignCarToUserUseCase", AssignCarToUserUseCase, ["carRepository"]],
    ]);

    // Controllers - Car
    // Контроллер получает зависимости по именам: порядок строк больше не может
    // молча подменить соседний кейс (раньше — 17 позиционных аргументов).
    this.register(
      "carController",
      (container) =>
        new CarController(
          container.resolveAll(
            "getCarsUseCase",
            "getUserCarsUseCase",
            "getCarByIdUseCase",
            "createCarUseCase",
            "updateCarUseCase",
            "deleteCarUseCase",
            "getCarImagesUseCase",
            "addCarImageUseCase",
            "updateCarImageUseCase",
            "deleteCarImageUseCase",
            "getCarAdminNotesUseCase",
            "addCarAdminNoteUseCase",
            "updateCarAdminNoteUseCase",
            "deleteCarAdminNoteUseCase",
            "mergeCarsUseCase",
            "assignCarToUserUseCase",
            "carImageUploadService"
          )
        )
    );

    // Use Cases - AdImage
    this.registerMany([
      ["createAdImagesUseCase", CreateAdImagesUseCase, ["adImageRepository", "adRepository", "postRepository"]],
      ["getAdImagesUseCase", GetAdImagesUseCase, ["adImageRepository"]],
      ["getImagesByIdUseCase", GetImagesByIdUseCase, ["adImageRepository"]],
      ["deleteAdImageUseCase", DeleteAdImageUseCase, ["adImageRepository"]],
      ["deleteMultipleAdImagesUseCase", DeleteMultipleAdImagesUseCase, ["adImageRepository"]],
      ["setMainImageUseCase", SetMainImageUseCase, ["adImageRepository"]],
    ]);

    // Controllers - AdImage
    this.registerMany([
      ["adImageController", AdImageController, ["createAdImagesUseCase", "getAdImagesUseCase", "getImagesByIdUseCase", "deleteAdImageUseCase", "deleteMultipleAdImagesUseCase", "setMainImageUseCase"]],
    ]);

    // Controllers - Upload
    this.registerMany([
      ["uploadController", UploadController, ["fileUploadService"]],
    ]);

    // Use Cases - House
    this.registerMany([
      ["getUniqueHousesUseCase", GetUniqueHousesUseCase, ["houseRepository"]],
      ["getEntrancesByHouseUseCase", GetEntrancesByHouseUseCase, ["houseRepository"]],
      ["getHousesByFilterUseCase", GetHousesByFilterUseCase, ["houseRepository"]],
      ["getUserHousesUseCase", GetUserHousesUseCase, ["houseRepository"]],
      ["getHouseInfoUseCase", GetHouseInfoUseCase, ["houseRepository"]],
      ["linkUserToApartmentUseCase", LinkUserToApartmentUseCase, ["houseRepository"]],
      ["unlinkUserFromApartmentUseCase", UnlinkUserFromApartmentUseCase, ["houseRepository"]],
      ["updateHouseInfoUseCase", UpdateHouseInfoUseCase, ["houseRepository"]],
      ["updateApartmentLayoutUseCase", UpdateApartmentLayoutUseCase, ["houseRepository"]],
    ]);

    // Use Cases - TelegramChat
    this.registerMany([
      ["getTelegramChatsUseCase", GetTelegramChatsUseCase, ["telegramChatRepository"]],
      ["createTelegramChatUseCase", CreateTelegramChatUseCase, ["telegramChatRepository"]],
      ["updateTelegramChatUseCase", UpdateTelegramChatUseCase, ["telegramChatRepository"]],
      ["deleteTelegramChatUseCase", DeleteTelegramChatUseCase, ["telegramChatRepository"]],
      ["toggleTelegramChatActiveUseCase", ToggleTelegramChatActiveUseCase, ["telegramChatRepository"]],
    ]);

    // Use Cases - Event (Real)
    this.registerMany([
      ["getEventsUseCase", GetEventsUseCase, []],
      ["getEventByIdUseCase", GetEventByIdUseCase, []],
      ["createEventUseCase", CreateEventUseCase, []],
      ["updateEventUseCase", UpdateEventUseCase, []],
      ["deleteEventUseCase", DeleteEventUseCase, []],
      ["registerForEventUseCase", RegisterForEventUseCase, []],
      ["unregisterFromEventUseCase", UnregisterFromEventUseCase, []],
    ]);

    // Use Cases - Parking (Real)
    this.register(
      "parkingUseCases",
      (container) =>
        new ParkingUseCases({
          delivery: container.resolve("messageDeliveryService"),
        })
    );

    // Use Cases - Заметки администрации о парковочном месте
    this.registerMany([
      ["getSpotNotesUseCase", GetSpotNotesUseCase, ["parkingSpotNoteRepository", "userRepository"]],
      ["addSpotNoteUseCase", AddSpotNoteUseCase, ["parkingSpotNoteRepository"]],
      ["deleteSpotNoteUseCase", DeleteSpotNoteUseCase, ["parkingSpotNoteRepository"]],
    ]);

    // Controllers - TelegramChat
    this.registerMany([
      // Реестр MAX-чатов: CRUD админки + проверка чата по id в MAX.
      ["getMaxChatsUseCase", GetMaxChatsUseCase, ["maxChatRepository"]],
      ["createMaxChatUseCase", CreateMaxChatUseCase, ["maxChatRepository"]],
      ["updateMaxChatUseCase", UpdateMaxChatUseCase, ["maxChatRepository"]],
      ["deleteMaxChatUseCase", DeleteMaxChatUseCase, ["maxChatRepository"]],
      ["lookupMaxChatUseCase", LookupMaxChatUseCase, ["maxChatRepository", "maxBotService"]],
      ["telegramChatController", TelegramChatController, ["getTelegramChatsUseCase", "createTelegramChatUseCase", "updateTelegramChatUseCase", "deleteTelegramChatUseCase", "toggleTelegramChatActiveUseCase"]],
    ]);

    // Controllers - House
    this.register(
      "houseController",
      (container) =>
        new HouseController(
          container.resolveAll(
            "getUniqueHousesUseCase",
            "getEntrancesByHouseUseCase",
            "getHousesByFilterUseCase",
            "getUserHousesUseCase",
            "getHouseInfoUseCase",
            "linkUserToApartmentUseCase",
            "unlinkUserFromApartmentUseCase",
            "updateHouseInfoUseCase",
            "updateApartmentLayoutUseCase",
            "createHouseCommentUseCase",
            "getHouseCommentsUseCase",
            "updateHouseCommentUseCase",
            "deleteHouseCommentUseCase",
            "createEntranceCommentUseCase",
            "getEntranceCommentUseCase",
            "updateEntranceCommentUseCase",
            "deleteEntranceCommentUseCase"
          )
        )
    );

    // Use Cases - Admin
    this.registerMany([
      ["getAllUsersUseCase", GetAllUsersUseCase, ["userRepository"]],
      ["updateUserRolesUseCase", UpdateUserRolesUseCase, ["userRepository"]],
      ["getStatisticsUseCase", GetStatisticsUseCase, []],
      ["getRoleCatalogUseCase", GetRoleCatalogUseCase, []],
    ]);

    // Controllers - Admin
    this.registerMany([
      ["adminController", AdminController, ["getAllUsersUseCase", "updateUserRolesUseCase", "getStatisticsUseCase", "getRoleCatalogUseCase"]],
    ]);

    // Controllers - Event
    this.registerMany([
      ["eventController", EventController, ["getEventsUseCase", "getEventByIdUseCase", "createEventUseCase", "updateEventUseCase", "deleteEventUseCase", "registerForEventUseCase", "unregisterFromEventUseCase"]],
    ]);

    // Controllers - Parking
    this.register(
      "parkingController",
      (container) =>
        new ParkingController({
          parkingUseCases: container.resolve("parkingUseCases"),
          getSpotNotesUseCase: container.resolve("getSpotNotesUseCase"),
          addSpotNoteUseCase: container.resolve("addSpotNoteUseCase"),
          deleteSpotNoteUseCase: container.resolve("deleteSpotNoteUseCase"),
        })
    );

    // Services - MAX Bot
    this.register("maxBotService", () => maxBotService);

    // Реестр MAX-чатов: контроллер собирается объектом зависимостей (как authController),
    // поэтому отдельно от registerMany — тот вызывает `new Factory(...)`.
    this.register(
      "maxChatController",
      (container) =>
        new MaxChatController(
          container.resolveAll(
            "getMaxChatsUseCase",
            "createMaxChatUseCase",
            "updateMaxChatUseCase",
            "deleteMaxChatUseCase",
            "lookupMaxChatUseCase"
          )
        )
    );

    // Сборщик входящих сообщений (long polling /updates). Стартуется из server.js,
    // Singleton — чтобы статус polling в админке показывал реальный цикл.
    this.register(
      "maxBotUpdatePoller",
      (container) =>
        new MaxBotUpdatePoller({
          service: container.resolve("maxBotService"),
        })
    );

    // Use Cases - MAX Bot
    this.register(
      "maxBotAdminUseCases",
      (container) =>
        new MaxBotAdminUseCases({
          service: container.resolve("maxBotService"),
          poller: container.resolve("maxBotUpdatePoller"),
        })
    );

    this.register(
      "maxBotBroadcastUseCases",
      (container) =>
        new MaxBotBroadcastUseCases({
          service: container.resolve("maxBotService"),
        })
    );

    // Controllers - MAX Bot
    this.register(
      "maxBotController",
      (container) =>
        new MaxBotController({
          adminUseCases: container.resolve("maxBotAdminUseCases"),
          broadcastUseCases: container.resolve("maxBotBroadcastUseCases"),
        })
    );
  }
}

// Export singleton instance
export const container = new Container();
export default container;
