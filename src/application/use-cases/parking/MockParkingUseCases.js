/**
 * Mock Parking Use Cases for development
 */
export class GetParkingSpotsUseCase {
  async execute(filters, pagination) {
    // Mock data
    const mockSpots = Array.from({ length: 99 }, (_, i) => ({
      id: i + 1,
      spot_number: `A${String(i + 1).padStart(2, "0")}`,
      spot_type: Math.random() > 0.9 ? "reserved" : "regular",
      is_occupied: Math.random() > 0.3,
      car_id: Math.random() > 0.3 ? Math.floor(Math.random() * 1000) : null,
      car:
        Math.random() > 0.3
          ? {
              id: Math.floor(Math.random() * 1000),
              make: ["Toyota", "BMW", "Mercedes", "Audi", "Volkswagen"][
                Math.floor(Math.random() * 5)
              ],
              model: ["Camry", "X5", "C-Class", "A4", "Golf"][
                Math.floor(Math.random() * 5)
              ],
              year: 2015 + Math.floor(Math.random() * 8),
              color: ["Белый", "Черный", "Серый", "Красный", "Синий"][
                Math.floor(Math.random() * 5)
              ],
              license_plate: `А${Math.floor(Math.random() * 999)}АА${Math.floor(
                Math.random() * 99
              )}`,
              owner: {
                username: `user${i + 1}`,
                first_name: "Иван",
                last_name: "Иванов",
              },
            }
          : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return {
      spots: mockSpots,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: mockSpots.length,
        totalPages: Math.ceil(mockSpots.length / pagination.limit),
      },
    };
  }
}

export class GetParkingSpotByIdUseCase {
  async execute(id) {
    return {
      id,
      spot_number: `A${String(id).padStart(2, "0")}`,
      spot_type: "regular",
      is_occupied: false,
      car_id: null,
      car: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export class CreateParkingSpotUseCase {
  async execute(spotData) {
    return {
      id: Math.floor(Math.random() * 1000),
      ...spotData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export class UpdateParkingSpotUseCase {
  async execute(id, spotData) {
    return {
      id,
      ...spotData,
      updated_at: new Date().toISOString(),
    };
  }
}

export class DeleteParkingSpotUseCase {
  async execute(id) {
    return true;
  }
}

export class AssignCarToSpotUseCase {
  async execute(spotId, carId) {
    return {
      id: spotId,
      spot_number: `A${String(spotId).padStart(2, "0")}`,
      spot_type: "regular",
      is_occupied: true,
      car_id: carId,
      updated_at: new Date().toISOString(),
    };
  }
}

export class FreeParkingSpotUseCase {
  async execute(spotId) {
    return {
      id: spotId,
      spot_number: `A${String(spotId).padStart(2, "0")}`,
      spot_type: "regular",
      is_occupied: false,
      car_id: null,
      updated_at: new Date().toISOString(),
    };
  }
}
