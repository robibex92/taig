/**
 * Get Comments Use Case
 * Retrieves all comments for an ad (with replies)
 */
class GetCommentsUseCase {
  constructor({ commentRepository }) {
    this.commentRepository = commentRepository;
  }

  async execute({ ad_id, includeDeleted = false }) {
    // Get comments with nested replies
    const comments = await this.commentRepository.findByAdId(ad_id, {
      includeDeleted,
    });

    return comments;
  }
}

module.exports = GetCommentsUseCase;
