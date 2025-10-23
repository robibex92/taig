/**
 * Mock Banner Use Cases for development
 */
export class GetBannersUseCase {
  async execute(filters, pagination) {
    // Mock data
    const mockBanners = [
      {
        id: 1,
        title: "Реклама магазина",
        description: "Описание баннера",
        image_url: "/uploads/banner1.jpg",
        link_url: "https://example.com",
        position: "vertical",
        is_active: true,
        display_order: 1,
        click_count: 0,
        view_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    return {
      banners: mockBanners,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: mockBanners.length,
        totalPages: 1,
      },
    };
  }
}

export class GetBannerByIdUseCase {
  async execute(id) {
    return {
      id,
      title: "Тестовый баннер",
      description: "Описание баннера",
      image_url: "/uploads/banner.jpg",
      link_url: "https://example.com",
      position: "vertical",
      is_active: true,
      display_order: 1,
      click_count: 0,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export class CreateBannerUseCase {
  async execute(bannerData) {
    return {
      id: Math.floor(Math.random() * 1000),
      ...bannerData,
      click_count: 0,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export class UpdateBannerUseCase {
  async execute(id, bannerData) {
    return {
      id,
      ...bannerData,
      updated_at: new Date().toISOString(),
    };
  }
}

export class DeleteBannerUseCase {
  async execute(id) {
    return true;
  }
}

export class ToggleBannerStatusUseCase {
  async execute(id, isActive) {
    return {
      id,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
  }
}

export class ClickBannerUseCase {
  async execute(id) {
    return true;
  }
}
