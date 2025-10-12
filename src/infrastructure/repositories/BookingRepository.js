const { prisma } = require("../database/prisma");
const Booking = require("../../domain/entities/Booking.entity");
const IBookingRepository = require("../../domain/repositories/IBookingRepository");

class BookingRepository extends IBookingRepository {
  async create(bookingData) {
    const booking = await prisma.booking.create({
      data: bookingData,
      include: {
        user: true,
        ad: {
          include: {
            user: true,
          },
        },
      },
    });

    return new Booking(booking);
  }

  async findById(id) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        ad: {
          include: {
            user: true,
          },
        },
      },
    });

    return booking ? new Booking(booking) : null;
  }

  async findByAdId(adId, options = {}) {
    const { status, orderBy = "created_at" } = options;

    const bookings = await prisma.booking.findMany({
      where: {
        ad_id: adId,
        ...(status && { status }),
      },
      include: {
        user: true,
      },
      orderBy: {
        [orderBy]: "asc",
      },
    });

    return bookings.map((b) => new Booking(b));
  }

  async findByUserId(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    const bookings = await prisma.booking.findMany({
      where: {
        user_id: userId,
        ...(status && { status }),
      },
      include: {
        ad: {
          include: {
            user: true,
            images: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: offset,
    });

    return bookings.map((b) => new Booking(b));
  }

  async findByAdAndUser(adId, userId) {
    const booking = await prisma.booking.findUnique({
      where: {
        ad_id_user_id: {
          ad_id: adId,
          user_id: userId,
        },
      },
      include: {
        user: true,
        ad: true,
      },
    });

    return booking ? new Booking(booking) : null;
  }

  async update(id, updateData) {
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
      include: {
        user: true,
        ad: {
          include: {
            user: true,
          },
        },
      },
    });

    return new Booking(booking);
  }

  async updateStatus(id, status, sellerNote = null) {
    const updateData = {
      status,
      updated_at: new Date(),
    };

    if (sellerNote !== null) {
      updateData.seller_note = sellerNote;
    }

    return this.update(id, updateData);
  }

  async delete(id) {
    await prisma.booking.delete({
      where: { id },
    });

    return true;
  }

  async getQueueByAdId(adId) {
    const bookings = await prisma.booking.findMany({
      where: {
        ad_id: adId,
        status: {
          in: ["pending", "confirmed"],
        },
      },
      include: {
        user: true,
      },
      orderBy: [
        { priority: "asc" }, // Lower priority number = higher in queue
        { created_at: "asc" }, // Earlier = higher in queue
      ],
    });

    return bookings.map((b) => new Booking(b));
  }

  async countActiveByAdId(adId) {
    return await prisma.booking.count({
      where: {
        ad_id: adId,
        status: {
          in: ["pending", "confirmed"],
        },
      },
    });
  }
}

module.exports = BookingRepository;
