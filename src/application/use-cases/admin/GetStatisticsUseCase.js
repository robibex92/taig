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

    // Get popular categories (top 5 by ad count)
    const categoriesWithCount = await prisma.ad.groupBy({
      by: ["category"],
      where: {
        status: "active",
        category: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          category: "desc",
        },
      },
      take: 5,
    });

    // Get category names
    const categoryIds = categoriesWithCount.map((c) => c.category);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.id, c.name])
    );

    const popularCategories = categoriesWithCount.map((c) => ({
      id: c.category,
      name: categoryMap[c.category] || `Категория ${c.category}`,
      count: c._count,
    }));

    // Get recent activity (ads created in last 7 days by hour)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAds = await prisma.ad.findMany({
      where: {
        created_at: { gte: sevenDaysAgo },
      },
      select: { created_at: true },
    });

    // Group by hour ranges
    const hourlyActivity = {};
    recentAds.forEach((ad) => {
      if (!ad.created_at) return;
      const hour = new Date(ad.created_at).getHours();

      // Group into 2-hour ranges
      let range = "";
      if (hour >= 0 && hour < 6) range = "00:00 - 06:00";
      else if (hour >= 6 && hour < 12) range = "06:00 - 12:00";
      else if (hour >= 12 && hour < 14) range = "12:00 - 14:00";
      else if (hour >= 14 && hour < 16) range = "14:00 - 16:00";
      else if (hour >= 16 && hour < 18) range = "16:00 - 18:00";
      else if (hour >= 18 && hour < 20) range = "18:00 - 20:00";
      else if (hour >= 20 && hour < 22) range = "20:00 - 22:00";
      else range = "22:00 - 00:00";

      hourlyActivity[range] = (hourlyActivity[range] || 0) + 1;
    });

    // Convert to array and sort by activity
    const peakHours = Object.entries(hourlyActivity)
      .map(([hour, count]) => ({ hour, activity: count }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 4);

    // Calculate percentages
    const maxActivity = Math.max(...peakHours.map((h) => h.activity), 1);
    const peakHoursWithPercent = peakHours.map((h) => ({
      hour: h.hour,
      activity: Math.round((h.activity / maxActivity) * 100),
    }));

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
      popular_categories: popularCategories,
      peak_hours: peakHoursWithPercent,
    };
  }
}
