import { prisma } from "../../../infrastructure/database/prisma.js";

/**
 * Get Statistics Use Case
 * Admin endpoint to get system statistics
 */
export class GetStatisticsUseCase {
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

    // Price is stored as String, so we can't use aggregate
    // Just skip avg_price calculation for now
    const avgPrice = { _avg: { price: 0 } };

    // Get booking statistics (if table exists)
    let totalBookings = 0;
    let bookingsByStatus = [];
    try {
      totalBookings = await prisma.booking.count();
      bookingsByStatus = await prisma.booking.groupBy({
        by: ["status"],
        _count: true,
      });
    } catch (error) {
      // Booking table might not exist
      console.warn("Booking table not found, skipping booking statistics");
    }

    // Get comment statistics (if Comment model exists)
    let totalComments = 0;
    let commentsToday = 0;
    try {
      totalComments = await prisma.comment.count({
        where: { is_deleted: false },
      });

      commentsToday = await prisma.comment.count({
        where: {
          is_deleted: false,
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });
    } catch (error) {
      // Comment model might not exist
      console.warn("Comment model not found, skipping comment statistics");
    }

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
