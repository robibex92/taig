const { prisma } = require("../database/prisma");
const Comment = require("../../domain/entities/Comment.entity");
const ICommentRepository = require("../../domain/repositories/ICommentRepository");

class CommentRepository extends ICommentRepository {
  async create(commentData) {
    const comment = await prisma.comment.create({
      data: commentData,
      include: {
        user: true,
        parent: true,
      },
    });

    return new Comment(comment);
  }

  async findById(id) {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        user: true,
        parent: true,
        replies: {
          include: {
            user: true,
          },
          orderBy: {
            created_at: "asc",
          },
        },
      },
    });

    return comment ? new Comment(comment) : null;
  }

  async findByAdId(adId, options = {}) {
    const { includeDeleted = false } = options;

    const comments = await prisma.comment.findMany({
      where: {
        ad_id: adId,
        parent_id: null, // Only root comments
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
      include: {
        user: true,
        replies: {
          where: includeDeleted ? {} : { is_deleted: false },
          include: {
            user: true,
          },
          orderBy: {
            created_at: "asc",
          },
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });

    return comments.map((c) => new Comment(c));
  }

  async findByUserId(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const comments = await prisma.comment.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
      },
      include: {
        ad: true,
        user: true,
        parent: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: offset,
    });

    return comments.map((c) => new Comment(c));
  }

  async findReplies(parentId) {
    const replies = await prisma.comment.findMany({
      where: {
        parent_id: parentId,
        is_deleted: false,
      },
      include: {
        user: true,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    return replies.map((r) => new Comment(r));
  }

  async update(id, content) {
    const comment = await prisma.comment.update({
      where: { id },
      data: {
        content,
        updated_at: new Date(),
      },
      include: {
        user: true,
        parent: true,
      },
    });

    return new Comment(comment);
  }

  async softDelete(id) {
    await prisma.comment.update({
      where: { id },
      data: {
        is_deleted: true,
        content: "[удалено]",
        updated_at: new Date(),
      },
    });

    return true;
  }

  async delete(id) {
    await prisma.comment.delete({
      where: { id },
    });

    return true;
  }

  async countByAdId(adId, includeDeleted = false) {
    return await prisma.comment.count({
      where: {
        ad_id: adId,
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
    });
  }

  async getCommentTree(adId) {
    // Get all comments for the ad
    const allComments = await prisma.comment.findMany({
      where: {
        ad_id: adId,
        is_deleted: false,
      },
      include: {
        user: true,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    // Build tree structure
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create all comment objects
    allComments.forEach((comment) => {
      const commentObj = new Comment({ ...comment, replies: [] });
      commentMap.set(comment.id, commentObj);
    });

    // Second pass: build tree
    allComments.forEach((comment) => {
      const commentObj = commentMap.get(comment.id);
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    });

    return rootComments;
  }
}

module.exports = CommentRepository;
