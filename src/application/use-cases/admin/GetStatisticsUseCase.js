const { prisma } = require("../../../infrastructure/database/prisma");

/**
 * Get Statistics Use Case
 * Admin endpoint to get system statistics
 */
class GetStatisticsUseCase {
  async execute() {
    // Get user statistics
    const totalUsers = await prisma.user.count();
    const usersByRole = await prisma.user.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get ad statistics
    const totalAds = await prisma.ad.count();
    const adsByStatus = await prisma.ad.groupBy({
      by: ["status"],
      _count: true,
    });

    const avgPrice = await prisma.ad.aggregate({
      _avg: {
        price: true,
      },
      where: {
        price: { not: null },
      },
    });

    // Get booking statistics
    const totalBookings = await prisma.booking.count();
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get comment statistics
    const totalComments = await prisma.comment.count({
      where: { is_deleted: false },
    });

    const commentsToday = await prisma.comment.count({
      where: {
        is_deleted: false,
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    // Get posts statistics
    const totalPosts = await prisma.post.count();
    const activePosts = await prisma.post.count({
      where: { status: "active" },
    });

    return {
      users: {
        total: totalUsers,
        by_role: Object.fromEntries(
          usersByRole.map((r) => [r.status, r._count])
        ),
      },
      ads: {
        total: totalAds,
        by_status: Object.fromEntries(
          adsByStatus.map((a) => [a.status, a._count])
        ),
        avg_price: avgPrice._avg.price || 0,
      },
      bookings: {
        total: totalBookings,
        by_status: Object.fromEntries(
          bookingsByStatus.map((b) => [b.status, b._count])
        ),
      },
      comments: {
        total: totalComments,
        today: commentsToday,
      },
      posts: {
        total: totalPosts,
        active: activePosts,
      },
    };
  }
}

module.exports = GetStatisticsUseCase;
