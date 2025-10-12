import express from "express";
import container from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { API_PREFIX, API_VERSION } from "../../core/constants/index.js";

const router = express.Router();
const postController = container.controllers.postController;

const BASE_ROUTE = `${API_PREFIX}/${API_VERSION}/posts`;

/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: News posts and announcements management
 */

/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Get all posts
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, deleted]
 *           default: active
 *         description: Filter posts by status
 *     responses:
 *       200:
 *         description: List of posts
 *       500:
 *         description: Internal Server Error
 */
router.get(BASE_ROUTE, postController.getPosts);

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               image_url:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, deleted]
 *               source:
 *                 type: string
 *               marker:
 *                 type: string
 *               isImportant:
 *                 type: boolean
 *               selectedChats:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     chatId:
 *                       type: string
 *                     threadId:
 *                       type: string
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.post(BASE_ROUTE, authenticateJWT, postController.createPost);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   patch:
 *     summary: Update a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               image_url:
 *                 type: string
 *               source:
 *                 type: string
 *               marker:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal Server Error
 */
router.patch(`${BASE_ROUTE}/:id`, authenticateJWT, postController.updatePost);

/**
 * @swagger
 * /api/v1/posts/{id}/close:
 *   patch:
 *     summary: Close (delete) a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal Server Error
 */
router.patch(
  `${BASE_ROUTE}/:id/close`,
  authenticateJWT,
  postController.deletePost
);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Delete a post (alternative endpoint)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal Server Error
 */
router.delete(`${BASE_ROUTE}/:id`, authenticateJWT, postController.deletePost);

export default router;
