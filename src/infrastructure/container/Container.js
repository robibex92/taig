// Repositories
import { AdRepository } from "../repositories/AdRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { PostRepository } from "../repositories/PostRepository.js";
import { CategoryRepository } from "../repositories/CategoryRepository.js";
import { FaqRepository } from "../repositories/FaqRepository.js";
import { FloorRuleRepository } from "../repositories/FloorRuleRepository.js";
import { CarRepository } from "../repositories/CarRepository.js";
import { AdImageRepository } from "../repositories/AdImageRepository.js";
import { HouseRepository } from "../repositories/HouseRepository.js";
import { RefreshTokenRepository } from "../repositories/RefreshTokenRepository.js";
import { TelegramChatRepository } from "../repositories/TelegramChatRepository.js";

// Services
import { TokenService } from "../../application/services/TokenService.improved.js";
import { TelegramService } from "../../application/services/TelegramService.js";
import { FileUploadService } from "../../application/services/FileUploadService.js";
import NotificationService from "../../application/services/NotificationService.js";

// Use Cases - Ad
import { GetAdsUseCase } from "../../application/use-cases/ad/GetAdsUseCase.js";
import { GetAdByIdUseCase } from "../../application/use-cases/ad/GetAdByIdUseCase.js";
import { CreateAdUseCase } from "../../application/use-cases/ad/CreateAdUseCase.js";
import { UpdateAdUseCase } from "../../application/use-cases/ad/UpdateAdUseCase.js";
import { DeleteAdUseCase } from "../../application/use-cases/ad/DeleteAdUseCase.js";

// Use Cases - User
import { AuthenticateUserUseCase } from "../../application/use-cases/user/AuthenticateUserUseCase.improved.js";
import { RefreshTokenUseCase } from "../../application/use-cases/user/RefreshTokenUseCase.improved.js";
import { UpdateUserUseCase } from "../../application/use-cases/user/UpdateUserUseCase.js";
import { UploadAvatarUseCase } from "../../application/use-cases/user/UploadAvatarUseCase.js";
import { LogoutUseCase } from "../../application/use-cases/user/LogoutUseCase.js";

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

// Use Cases - FAQ
import { GetFaqsUseCase } from "../../application/use-cases/faq/GetFaqsUseCase.js";
import { UpdateFaqUseCase } from "../../application/use-cases/faq/UpdateFaqUseCase.js";
import { DeleteFaqUseCase } from "../../application/use-cases/faq/DeleteFaqUseCase.js";

// Use Cases - FloorRule
import { GetFloorRulesUseCase } from "../../application/use-cases/floorRule/GetFloorRulesUseCase.js";
import { UpsertFloorRuleUseCase } from "../../application/use-cases/floorRule/UpsertFloorRuleUseCase.js";

// Use Cases - Car
import { GetCarsUseCase } from "../../application/use-cases/car/GetCarsUseCase.js";
import { GetUserCarsUseCase } from "../../application/use-cases/car/GetUserCarsUseCase.js";
import { CreateCarUseCase } from "../../application/use-cases/car/CreateCarUseCase.js";
import { DeleteCarUseCase } from "../../application/use-cases/car/DeleteCarUseCase.js";

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

// Use Cases - TelegramChat
import { GetTelegramChatsUseCase } from "../../application/use-cases/telegramChat/GetTelegramChatsUseCase.js";
import { CreateTelegramChatUseCase } from "../../application/use-cases/telegramChat/CreateTelegramChatUseCase.js";
import { UpdateTelegramChatUseCase } from "../../application/use-cases/telegramChat/UpdateTelegramChatUseCase.js";
import { DeleteTelegramChatUseCase } from "../../application/use-cases/telegramChat/DeleteTelegramChatUseCase.js";
import { ToggleTelegramChatActiveUseCase } from "../../application/use-cases/telegramChat/ToggleTelegramChatActiveUseCase.js";

// Use Cases - Admin
import { GetAllUsersUseCase } from "../../application/use-cases/admin/GetAllUsersUseCase.js";
import { UpdateUserRoleUseCase } from "../../application/use-cases/admin/UpdateUserRoleUseCase.js";
import { GetStatisticsUseCase } from "../../application/use-cases/admin/GetStatisticsUseCase.js";

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
   * Setup all dependencies
   */
  setupDependencies() {
    // Repositories
    this.register("adRepository", () => new AdRepository());
    this.register("userRepository", () => new UserRepository());
    this.register("postRepository", () => new PostRepository());
    this.register("categoryRepository", () => new CategoryRepository());
    this.register("faqRepository", () => new FaqRepository());
    this.register("floorRuleRepository", () => new FloorRuleRepository());
    this.register("carRepository", () => new CarRepository());
    this.register("adImageRepository", () => new AdImageRepository());
    this.register("houseRepository", () => new HouseRepository());
    this.register("refreshTokenRepository", () => new RefreshTokenRepository());
    this.register("telegramChatRepository", () => new TelegramChatRepository());

    // Services
    this.register("tokenService", () => new TokenService());
    this.register(
      "telegramService",
      (container) =>
        new TelegramService(
          container.resolve("adRepository"),
          container.resolve("postRepository")
        )
    );
    this.register("fileUploadService", () => new FileUploadService());

    // Notification Service
    this.register(
      "notificationService",
      (container) =>
        new NotificationService({
          userRepository: container.resolve("userRepository"),
          telegramService: container.resolve("telegramService"),
        })
    );

    // Use Cases - Ad
    this.register(
      "getAdsUseCase",
      (container) => new GetAdsUseCase(container.resolve("adRepository"))
    );

    this.register(
      "getAdByIdUseCase",
      (container) => new GetAdByIdUseCase(container.resolve("adRepository"))
    );

    this.register(
      "createAdUseCase",
      (container) =>
        new CreateAdUseCase(
          container.resolve("adRepository"),
          container.resolve("userRepository"),
          container.resolve("telegramChatRepository"),
          container.resolve("telegramService")
        )
    );

    this.register(
      "updateAdUseCase",
      (container) =>
        new UpdateAdUseCase(
          container.resolve("adRepository"),
          container.resolve("telegramService")
        )
    );

    this.register(
      "deleteAdUseCase",
      (container) => new DeleteAdUseCase(container.resolve("adRepository"))
    );

    // Use Cases - User
    this.register(
      "authenticateUserUseCase",
      (container) =>
        new AuthenticateUserUseCase(
          container.resolve("userRepository"),
          container.resolve("tokenService"),
          container.resolve("refreshTokenRepository")
        )
    );

    this.register(
      "refreshTokenUseCase",
      (container) =>
        new RefreshTokenUseCase(
          container.resolve("userRepository"),
          container.resolve("tokenService"),
          container.resolve("refreshTokenRepository")
        )
    );

    this.register(
      "updateUserUseCase",
      (container) => new UpdateUserUseCase(container.resolve("userRepository"))
    );

    this.register(
      "uploadAvatarUseCase",
      (container) =>
        new UploadAvatarUseCase(container.resolve("userRepository"))
    );

    this.register(
      "logoutUseCase",
      (container) =>
        new LogoutUseCase(
          container.resolve("refreshTokenRepository"),
          container.resolve("tokenService")
        )
    );

    // Use Cases - Session
    this.register(
      "getUserSessionsUseCase",
      (container) =>
        new GetUserSessionsUseCase(
          container.resolve("refreshTokenRepository"),
          container.resolve("tokenService")
        )
    );

    this.register(
      "revokeSessionUseCase",
      (container) =>
        new RevokeSessionUseCase(container.resolve("refreshTokenRepository"))
    );

    this.register(
      "revokeAllSessionsUseCase",
      (container) =>
        new RevokeAllSessionsUseCase(
          container.resolve("refreshTokenRepository")
        )
    );

    // Use Cases - Post
    this.register(
      "getPostsUseCase",
      (container) => new GetPostsUseCase(container.resolve("postRepository"))
    );

    this.register(
      "createPostUseCase",
      (container) =>
        new CreatePostUseCase(
          container.resolve("postRepository"),
          container.resolve("telegramService")
        )
    );

    this.register(
      "updatePostUseCase",
      (container) =>
        new UpdatePostUseCase(
          container.resolve("postRepository"),
          container.resolve("telegramService")
        )
    );

    this.register(
      "deletePostUseCase",
      (container) =>
        new DeletePostUseCase(
          container.resolve("postRepository"),
          container.resolve("telegramService")
        )
    );

    // Controllers
    this.register(
      "adController",
      (container) =>
        new AdController(
          container.resolve("getAdsUseCase"),
          container.resolve("getAdByIdUseCase"),
          container.resolve("createAdUseCase"),
          container.resolve("updateAdUseCase"),
          container.resolve("deleteAdUseCase"),
          container.resolve("adRepository"),
          container.resolve("telegramService")
        )
    );

    this.register(
      "authController",
      (container) =>
        new AuthController(
          container.resolve("authenticateUserUseCase"),
          container.resolve("refreshTokenUseCase"),
          container.resolve("logoutUseCase"),
          container.resolve("getUserSessionsUseCase"),
          container.resolve("revokeSessionUseCase"),
          container.resolve("revokeAllSessionsUseCase"),
          container.resolve("userRepository"),
          container.resolve("tokenService")
        )
    );

    this.register(
      "userController",
      (container) =>
        new UserController(
          container.resolve("updateUserUseCase"),
          container.resolve("userRepository"),
          container.resolve("adRepository"),
          container.resolve("uploadAvatarUseCase")
        )
    );

    this.register(
      "postController",
      (container) =>
        new PostController(
          container.resolve("getPostsUseCase"),
          container.resolve("createPostUseCase"),
          container.resolve("updatePostUseCase"),
          container.resolve("deletePostUseCase")
        )
    );

    // Use Cases - Category
    this.register(
      "getCategoriesUseCase",
      (container) =>
        new GetCategoriesUseCase(container.resolve("categoryRepository"))
    );

    this.register(
      "getCategoryByIdUseCase",
      (container) =>
        new GetCategoryByIdUseCase(container.resolve("categoryRepository"))
    );

    this.register(
      "getSubcategoriesUseCase",
      (container) =>
        new GetSubcategoriesUseCase(container.resolve("categoryRepository"))
    );

    this.register(
      "getAllSubcategoriesUseCase",
      (container) =>
        new GetAllSubcategoriesUseCase(container.resolve("categoryRepository"))
    );

    this.register(
      "getSubcategoryByIdUseCase",
      (container) =>
        new GetSubcategoryByIdUseCase(container.resolve("categoryRepository"))
    );

    // Controllers - Category
    this.register(
      "categoryController",
      (container) =>
        new CategoryController(
          container.resolve("getCategoriesUseCase"),
          container.resolve("getCategoryByIdUseCase"),
          container.resolve("getSubcategoriesUseCase"),
          container.resolve("getAllSubcategoriesUseCase"),
          container.resolve("getSubcategoryByIdUseCase")
        )
    );

    // Use Cases - FAQ
    this.register(
      "getFaqsUseCase",
      (container) => new GetFaqsUseCase(container.resolve("faqRepository"))
    );

    this.register(
      "updateFaqUseCase",
      (container) => new UpdateFaqUseCase(container.resolve("faqRepository"))
    );

    this.register(
      "deleteFaqUseCase",
      (container) => new DeleteFaqUseCase(container.resolve("faqRepository"))
    );

    // Controllers - FAQ
    this.register(
      "faqController",
      (container) =>
        new FaqController(
          container.resolve("getFaqsUseCase"),
          container.resolve("updateFaqUseCase"),
          container.resolve("deleteFaqUseCase")
        )
    );

    // Use Cases - FloorRule
    this.register(
      "getFloorRulesUseCase",
      (container) =>
        new GetFloorRulesUseCase(container.resolve("floorRuleRepository"))
    );

    this.register(
      "upsertFloorRuleUseCase",
      (container) =>
        new UpsertFloorRuleUseCase(container.resolve("floorRuleRepository"))
    );

    // Controllers - FloorRule
    this.register(
      "floorRuleController",
      (container) =>
        new FloorRuleController(
          container.resolve("getFloorRulesUseCase"),
          container.resolve("upsertFloorRuleUseCase")
        )
    );

    // Use Cases - Car
    this.register(
      "getCarsUseCase",
      (container) => new GetCarsUseCase(container.resolve("carRepository"))
    );

    this.register(
      "getUserCarsUseCase",
      (container) => new GetUserCarsUseCase(container.resolve("carRepository"))
    );

    this.register(
      "createCarUseCase",
      (container) => new CreateCarUseCase(container.resolve("carRepository"))
    );

    this.register(
      "deleteCarUseCase",
      (container) => new DeleteCarUseCase(container.resolve("carRepository"))
    );

    // Controllers - Car
    this.register(
      "carController",
      (container) =>
        new CarController(
          container.resolve("getCarsUseCase"),
          container.resolve("getUserCarsUseCase"),
          container.resolve("createCarUseCase"),
          container.resolve("deleteCarUseCase")
        )
    );

    // Use Cases - AdImage
    this.register(
      "createAdImagesUseCase",
      (container) =>
        new CreateAdImagesUseCase(
          container.resolve("adImageRepository"),
          container.resolve("adRepository"),
          container.resolve("postRepository")
        )
    );

    this.register(
      "getAdImagesUseCase",
      (container) =>
        new GetAdImagesUseCase(container.resolve("adImageRepository"))
    );

    this.register(
      "getImagesByIdUseCase",
      (container) =>
        new GetImagesByIdUseCase(container.resolve("adImageRepository"))
    );

    this.register(
      "deleteAdImageUseCase",
      (container) =>
        new DeleteAdImageUseCase(container.resolve("adImageRepository"))
    );

    this.register(
      "deleteMultipleAdImagesUseCase",
      (container) =>
        new DeleteMultipleAdImagesUseCase(
          container.resolve("adImageRepository")
        )
    );

    this.register(
      "setMainImageUseCase",
      (container) =>
        new SetMainImageUseCase(container.resolve("adImageRepository"))
    );

    // Controllers - AdImage
    this.register(
      "adImageController",
      (container) =>
        new AdImageController(
          container.resolve("createAdImagesUseCase"),
          container.resolve("getAdImagesUseCase"),
          container.resolve("getImagesByIdUseCase"),
          container.resolve("deleteAdImageUseCase"),
          container.resolve("deleteMultipleAdImagesUseCase"),
          container.resolve("setMainImageUseCase")
        )
    );

    // Controllers - Upload
    this.register(
      "uploadController",
      (container) =>
        new UploadController(container.resolve("fileUploadService"))
    );

    // Use Cases - House
    this.register(
      "getUniqueHousesUseCase",
      (container) =>
        new GetUniqueHousesUseCase(container.resolve("houseRepository"))
    );

    this.register(
      "getEntrancesByHouseUseCase",
      (container) =>
        new GetEntrancesByHouseUseCase(container.resolve("houseRepository"))
    );

    this.register(
      "getHousesByFilterUseCase",
      (container) =>
        new GetHousesByFilterUseCase(container.resolve("houseRepository"))
    );

    this.register(
      "getUserHousesUseCase",
      (container) =>
        new GetUserHousesUseCase(container.resolve("houseRepository"))
    );

    this.register(
      "getHouseInfoUseCase",
      (container) =>
        new GetHouseInfoUseCase(container.resolve("houseRepository"))
    );

    this.register(
      "linkUserToApartmentUseCase",
      (container) =>
        new LinkUserToApartmentUseCase(container.resolve("houseRepository"))
    );

    this.register(
      "unlinkUserFromApartmentUseCase",
      (container) =>
        new UnlinkUserFromApartmentUseCase(container.resolve("houseRepository"))
    );

    // Use Cases - TelegramChat
    this.register(
      "getTelegramChatsUseCase",
      (container) =>
        new GetTelegramChatsUseCase(container.resolve("telegramChatRepository"))
    );

    this.register(
      "createTelegramChatUseCase",
      (container) =>
        new CreateTelegramChatUseCase(
          container.resolve("telegramChatRepository")
        )
    );

    this.register(
      "updateTelegramChatUseCase",
      (container) =>
        new UpdateTelegramChatUseCase(
          container.resolve("telegramChatRepository")
        )
    );

    this.register(
      "deleteTelegramChatUseCase",
      (container) =>
        new DeleteTelegramChatUseCase(
          container.resolve("telegramChatRepository")
        )
    );

    this.register(
      "toggleTelegramChatActiveUseCase",
      (container) =>
        new ToggleTelegramChatActiveUseCase(
          container.resolve("telegramChatRepository")
        )
    );

    // Controllers - TelegramChat
    this.register(
      "telegramChatController",
      (container) =>
        new TelegramChatController(
          container.resolve("getTelegramChatsUseCase"),
          container.resolve("createTelegramChatUseCase"),
          container.resolve("updateTelegramChatUseCase"),
          container.resolve("deleteTelegramChatUseCase"),
          container.resolve("toggleTelegramChatActiveUseCase")
        )
    );

    // Controllers - House
    this.register(
      "houseController",
      (container) =>
        new HouseController(
          container.resolve("getUniqueHousesUseCase"),
          container.resolve("getEntrancesByHouseUseCase"),
          container.resolve("getHousesByFilterUseCase"),
          container.resolve("getUserHousesUseCase"),
          container.resolve("getHouseInfoUseCase"),
          container.resolve("linkUserToApartmentUseCase"),
          container.resolve("unlinkUserFromApartmentUseCase")
        )
    );

    // Use Cases - Admin
    this.register(
      "getAllUsersUseCase",
      (container) => new GetAllUsersUseCase(container.resolve("userRepository"))
    );

    this.register(
      "updateUserRoleUseCase",
      (container) =>
        new UpdateUserRoleUseCase(container.resolve("userRepository"))
    );

    this.register("getStatisticsUseCase", () => new GetStatisticsUseCase());

    // Controllers - Admin
    this.register(
      "adminController",
      (container) =>
        new AdminController(
          container.resolve("getAllUsersUseCase"),
          container.resolve("updateUserRoleUseCase"),
          container.resolve("getStatisticsUseCase")
        )
    );
  }
}

// Export singleton instance
export const container = new Container();
export default container;
