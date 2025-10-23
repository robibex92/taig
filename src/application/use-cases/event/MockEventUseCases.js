/**
 * Mock Event Use Cases for development
 */
export class GetEventsUseCase {
  async execute(filters, pagination) {
    // Mock data
    const mockEvents = [
      {
        id: 1,
        title: "Собрание жильцов",
        description: "Обсуждение вопросов ЖК",
        event_type: "meeting",
        location: "Конференц-зал",
        start_date: new Date(Date.now() + 86400000).toISOString(),
        end_date: new Date(Date.now() + 86400000 + 7200000).toISOString(),
        max_participants: 50,
        status: "active",
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        registrations_count: 5,
      },
    ];

    return {
      events: mockEvents,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: mockEvents.length,
        totalPages: 1,
      },
    };
  }
}

export class GetEventByIdUseCase {
  async execute(id) {
    return {
      id,
      title: "Тестовое событие",
      description: "Описание события",
      event_type: "general",
      location: "Место проведения",
      start_date: new Date(Date.now() + 86400000).toISOString(),
      end_date: new Date(Date.now() + 86400000 + 7200000).toISOString(),
      max_participants: 30,
      status: "active",
      created_by: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export class CreateEventUseCase {
  async execute(eventData, userId) {
    return {
      id: Math.floor(Math.random() * 1000),
      ...eventData,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export class UpdateEventUseCase {
  async execute(id, eventData, userId) {
    return {
      id,
      ...eventData,
      updated_at: new Date().toISOString(),
    };
  }
}

export class DeleteEventUseCase {
  async execute(id, userId) {
    return true;
  }
}

export class RegisterForEventUseCase {
  async execute(eventId, userId) {
    return {
      id: Math.floor(Math.random() * 1000),
      event_id: eventId,
      user_id: userId,
      registered_at: new Date().toISOString(),
    };
  }
}

export class GetEventRegistrationsUseCase {
  async execute(eventId) {
    return [
      {
        id: 1,
        event_id: eventId,
        user_id: 1,
        registered_at: new Date().toISOString(),
        user: {
          username: "testuser",
          first_name: "Тест",
          last_name: "Пользователь",
        },
      },
    ];
  }
}
