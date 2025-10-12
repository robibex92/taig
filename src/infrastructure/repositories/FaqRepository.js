import { prisma } from "../database/prisma.js";
import { IFaqRepository } from "../../domain/repositories/IFaqRepository.js";
import { Faq } from "../../domain/entities/Faq.entity.js";

/**
 * FAQ Repository Implementation with Prisma
 * Handles database operations for FAQs
 */
export class FaqRepository extends IFaqRepository {
  /**
   * Get all FAQs with optional status filter
   */
  async findAll(status = null) {
    const where = {};

    if (status) {
      where.status = status;
    }

    const faqs = await prisma.faq.findMany({
      where,
      orderBy: { id: "asc" },
    });

    return faqs.map((faq) => Faq.fromDatabase(faq));
  }

  /**
   * Find FAQ by ID
   */
  async findById(id) {
    const faq = await prisma.faq.findUnique({
      where: { id: BigInt(id) },
    });

    return faq ? Faq.fromDatabase(faq) : null;
  }

  /**
   * Update FAQ
   */
  async update(id, updateData) {
    const faq = await prisma.faq.update({
      where: { id: BigInt(id) },
      data: {
        ...(updateData.question !== undefined && {
          question: updateData.question,
        }),
        ...(updateData.answer !== undefined && { answer: updateData.answer }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        updated_at: new Date(),
      },
    });

    return Faq.fromDatabase(faq);
  }

  /**
   * Soft delete FAQ (set status to 'deleted')
   */
  async softDelete(id) {
    const faq = await prisma.faq.update({
      where: { id: BigInt(id) },
      data: {
        status: "deleted",
        updated_at: new Date(),
      },
    });

    return faq !== null;
  }
}
