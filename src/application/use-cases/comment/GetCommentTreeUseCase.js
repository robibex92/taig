/**
 * Get Comment Tree Use Case
 * Retrieves comments in a tree structure with nested replies
 */
class GetCommentTreeUseCase {
  constructor({ commentRepository }) {
    this.commentRepository = commentRepository;
  }

  async execute({ ad_id }) {
    // Get comment tree with nested replies
    const commentTree = await this.commentRepository.getCommentTree(ad_id);

    return commentTree;
  }
}

module.exports = GetCommentTreeUseCase;
