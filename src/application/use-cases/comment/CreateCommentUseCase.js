const Comment = require("../../../domain/entities/Comment.entity");
const {
  NotFoundError,
  ValidationError,
} = require("../../../core/errors/AppError");

/**
 * Create Comment Use Case
 * Creates a new comment or reply
 */
class CreateCommentUseCase {
  constructor({ commentRepository, adRepository }) {
    this.commentRepository = commentRepository;
    this.adRepository = adRepository;
  }

  async execute({ ad_id, user_id, content, parent_id = null }) {
    // Validate data
    const validation = Comment.validate({ ad_id, user_id, content });
    if (!validation.isValid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    // Check if ad exists and is active
    const ad = await this.adRepository.findById(ad_id);
    if (!ad) {
      throw new NotFoundError("Ad not found");
    }

    if (ad.status === "closed") {
      throw new ValidationError("Cannot comment on closed ads");
    }

    // Check if parent comment exists (for replies)
    if (parent_id) {
      const parentComment = await this.commentRepository.findById(parent_id);
      if (!parentComment || parentComment.ad_id !== ad_id) {
        throw new NotFoundError("Parent comment not found");
      }
    }

    // Determine if user is the seller
    const is_seller = ad.user_id === user_id;

    // Create comment
    const commentData = {
      ad_id,
      user_id,
      content,
      parent_id,
      is_seller,
    };

    const comment = await this.commentRepository.create(commentData);

    return comment;
  }
}

module.exports = CreateCommentUseCase;
