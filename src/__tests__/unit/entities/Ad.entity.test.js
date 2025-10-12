import { AdEntity } from "../../../domain/entities/Ad.entity.js";
import { AD_STATUS } from "../../../core/constants/index.js";

describe("AdEntity", () => {
  const mockAdData = {
    id: 1,
    user_id: 123,
    title: "Test Ad",
    content: "Test content",
    category: "furniture",
    subcategory: "sofa",
    price: "5000",
    status: AD_STATUS.ACTIVE,
    view_count: 10,
  };

  describe("constructor", () => {
    it("should create an ad entity with correct data", () => {
      const ad = new AdEntity(mockAdData);

      expect(ad.id).toBe(1);
      expect(ad.user_id).toBe(123);
      expect(ad.title).toBe("Test Ad");
      expect(ad.content).toBe("Test content");
      expect(ad.status).toBe(AD_STATUS.ACTIVE);
    });

    it("should set default values for optional fields", () => {
      const minimalData = {
        user_id: 123,
        title: "Test",
        content: "Content",
        category: "test",
      };
      const ad = new AdEntity(minimalData);

      expect(ad.subcategory).toBeNull();
      expect(ad.price).toBeNull();
      expect(ad.status).toBe(AD_STATUS.ACTIVE);
      expect(ad.view_count).toBe(0);
      expect(ad.images).toEqual([]);
    });
  });

  describe("belongsToUser", () => {
    it("should return true if ad belongs to user", () => {
      const ad = new AdEntity(mockAdData);
      expect(ad.belongsToUser(123)).toBe(true);
    });

    it("should return false if ad does not belong to user", () => {
      const ad = new AdEntity(mockAdData);
      expect(ad.belongsToUser(456)).toBe(false);
    });
  });

  describe("isActive", () => {
    it("should return true for active ads", () => {
      const ad = new AdEntity(mockAdData);
      expect(ad.isActive()).toBe(true);
    });

    it("should return false for non-active ads", () => {
      const archivedAd = new AdEntity({
        ...mockAdData,
        status: AD_STATUS.ARCHIVE,
      });
      expect(archivedAd.isActive()).toBe(false);
    });
  });

  describe("archive", () => {
    it("should set status to archive", () => {
      const ad = new AdEntity(mockAdData);
      ad.archive();

      expect(ad.status).toBe(AD_STATUS.ARCHIVE);
    });
  });

  describe("incrementViewCount", () => {
    it("should increment view count by 1", () => {
      const ad = new AdEntity(mockAdData);
      const initialCount = ad.view_count;

      ad.incrementViewCount();

      expect(ad.view_count).toBe(initialCount + 1);
    });
  });

  describe("update", () => {
    it("should update allowed fields", () => {
      const ad = new AdEntity(mockAdData);
      ad.update({
        title: "Updated Title",
        price: "6000",
      });

      expect(ad.title).toBe("Updated Title");
      expect(ad.price).toBe("6000");
    });

    it("should ignore non-allowed fields", () => {
      const ad = new AdEntity(mockAdData);
      const originalId = ad.id;

      ad.update({
        id: 999, // Should be ignored
        title: "Updated",
      });

      expect(ad.id).toBe(originalId);
      expect(ad.title).toBe("Updated");
    });
  });

  describe("toJSON", () => {
    it("should return a plain object representation", () => {
      const ad = new AdEntity(mockAdData);
      const json = ad.toJSON();

      expect(json).toEqual(
        expect.objectContaining({
          id: 1,
          user_id: 123,
          title: "Test Ad",
          content: "Test content",
          status: AD_STATUS.ACTIVE,
        })
      );
    });
  });
});
