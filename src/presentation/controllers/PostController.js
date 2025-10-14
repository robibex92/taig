import { validate } from "../../core/validation/validator.js";
import {
  createPostSchema,
  updatePostSchema,
  getPostsQuerySchema,
} from "../../core/validation/schemas/post.schema.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Post Controller
 * Handles HTTP requests for posts/news
 */
export class PostController {
  constructor(
    getPostsUseCase,
    createPostUseCase,
    updatePostUseCase,
    deletePostUseCase
  ) {
    this.getPostsUseCase = getPostsUseCase;
    this.createPostUseCase = createPostUseCase;
    this.updatePostUseCase = updatePostUseCase;
    this.deletePostUseCase = deletePostUseCase;
  }

  /**
   * Get all posts (with optional status filter)
   * GET /api-v1/posts?status=active
   */
  getPosts = async (req, res, next) => {
    try {
      const filters = validate(getPostsQuerySchema, req.query, "query");

      const posts = await this.getPostsUseCase.execute(filters);

      res.json({
        success: true,
        data: posts,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new post
   * POST /api-v1/posts
   */
  createPost = async (req, res, next) => {
    try {
      const validatedData = validate(createPostSchema, req.body);

      const { isImportant, selectedChats, photos, ...postData } = validatedData;

      const newPost = await this.createPostUseCase.execute(
        postData,
        isImportant,
        selectedChats,
        photos,
        req.user // Pass authenticated user
      );

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: newPost,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a post
   * PATCH /api-v1/posts/:id
   */
  updatePost = async (req, res, next) => {
    try {
      const { id } = req.params;
      const validatedData = validate(updatePostSchema, req.body);

      const updatedPost = await this.updatePostUseCase.execute(
        parseInt(id),
        validatedData,
        req.user // Pass authenticated user
      );

      res.json({
        success: true,
        message: "Post updated successfully",
        data: updatedPost,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete (close) a post
   * PATCH /api-v1/posts/:id/close
   * or DELETE /api-v1/posts/:id
   */
  deletePost = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.deletePostUseCase.execute(
        parseInt(id),
        req.user
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
