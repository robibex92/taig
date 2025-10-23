-- ============================================
-- MIGRATION: Add Events, Banners, and Parking
-- ============================================
-- Добавляет новые таблицы для:
-- - Календарь событий ЖК
-- - Система баннеров
-- - Управление парковкой
-- - Обновляет роли пользователей
-- ============================================

-- Обновляем статусы пользователей (добавляем роль "активист")
-- Это делается через изменение существующих записей, если нужно

-- ============================================
-- EVENTS (Календарь событий ЖК)
-- ============================================

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'general' NOT NULL, -- general, meeting, cleanup, celebration, repair
    location VARCHAR(255), -- Место проведения
    start_date TIMESTAMPTZ(6) NOT NULL,
    end_date TIMESTAMPTZ(6),
    max_participants INTEGER, -- Ограничение участников
    is_recurring BOOLEAN DEFAULT false NOT NULL, -- Повторяющееся событие
    recurring_type VARCHAR(50), -- daily, weekly, monthly
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- active, cancelled, completed
    created_by BIGINT NOT NULL, -- Создатель события
    created_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    
    CONSTRAINT fk_events_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Индексы для events
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_created_by ON events(created_by);

-- ============================================
-- EVENT REGISTRATIONS (Регистрации на события)
-- ============================================

CREATE TABLE event_registrations (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    registered_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    status VARCHAR(50) DEFAULT 'registered' NOT NULL, -- registered, cancelled, attended
    
    CONSTRAINT fk_event_registrations_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_registrations_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT unique_event_user_registration UNIQUE (event_id, user_id)
);

-- Индексы для event_registrations
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);

-- ============================================
-- BANNERS (Система баннеров)
-- ============================================

CREATE TABLE banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    image_url TEXT NOT NULL,
    link_url TEXT, -- Ссылка при клике
    position VARCHAR(50) NOT NULL, -- top_vertical, right_sidebar
    is_active BOOLEAN DEFAULT true NOT NULL,
    display_order INTEGER DEFAULT 0 NOT NULL, -- Порядок отображения
    start_date TIMESTAMPTZ(6), -- Дата начала показа
    end_date TIMESTAMPTZ(6), -- Дата окончания показа
    click_count INTEGER DEFAULT 0 NOT NULL, -- Счетчик кликов
    view_count INTEGER DEFAULT 0 NOT NULL, -- Счетчик просмотров
    created_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL
);

-- Индексы для banners
CREATE INDEX idx_banners_position ON banners(position);
CREATE INDEX idx_banners_is_active ON banners(is_active);
CREATE INDEX idx_banners_display_order ON banners(display_order);
CREATE INDEX idx_banners_date_range ON banners(start_date, end_date);

-- ============================================
-- PARKING SPOTS (Места парковки)
-- ============================================

CREATE TABLE parking_spots (
    id BIGSERIAL PRIMARY KEY,
    spot_number VARCHAR(10) NOT NULL UNIQUE, -- Номер места (например, "A01", "B15")
    spot_type VARCHAR(50) DEFAULT 'regular' NOT NULL, -- regular, disabled, electric, reserved
    is_occupied BOOLEAN DEFAULT false NOT NULL,
    owner_id BIGINT, -- Владелец места (если закреплено)
    car_id BIGINT, -- Припаркованная машина
    occupied_since TIMESTAMPTZ(6), -- Когда занято
    notes TEXT, -- Заметки
    created_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    
    CONSTRAINT fk_parking_spots_owner FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_parking_spots_car FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE SET NULL
);

-- Индексы для parking_spots
CREATE INDEX idx_parking_spots_spot_type ON parking_spots(spot_type);
CREATE INDEX idx_parking_spots_is_occupied ON parking_spots(is_occupied);
CREATE INDEX idx_parking_spots_owner_id ON parking_spots(owner_id);

-- ============================================
-- PARKING HISTORY (История парковки)
-- ============================================

CREATE TABLE parking_history (
    id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    car_id BIGINT,
    user_id BIGINT,
    action VARCHAR(50) NOT NULL, -- parked, left, reserved, freed
    timestamp TIMESTAMPTZ(6) DEFAULT NOW() NOT NULL,
    notes TEXT,
    
    CONSTRAINT fk_parking_history_spot FOREIGN KEY (spot_id) REFERENCES parking_spots(id) ON DELETE CASCADE,
    CONSTRAINT fk_parking_history_car FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE SET NULL,
    CONSTRAINT fk_parking_history_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Индексы для parking_history
CREATE INDEX idx_parking_history_spot_id ON parking_history(spot_id);
CREATE INDEX idx_parking_history_timestamp ON parking_history(timestamp);
CREATE INDEX idx_parking_history_action ON parking_history(action);

-- ============================================
-- TRIGGERS для автоматического обновления updated_at
-- ============================================

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parking_spots_updated_at BEFORE UPDATE ON parking_spots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Начальные данные)
-- ============================================

-- Создаем базовые места парковки (пример для 99 мест)
-- Формат: A01-A99, B01-B99, C01-C99 и т.д.
-- Пока создадим только несколько примеров

INSERT INTO parking_spots (spot_number, spot_type) VALUES
('A01', 'regular'),
('A02', 'regular'),
('A03', 'disabled'),
('A04', 'regular'),
('A05', 'electric'),
('B01', 'regular'),
('B02', 'regular'),
('B03', 'reserved'),
('B04', 'regular'),
('B05', 'regular');

-- Создаем пример баннера (неактивный)
INSERT INTO banners (title, image_url, position, is_active, display_order) VALUES
('Пример баннера', '/images/banner-example.jpg', 'top_vertical', false, 0);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE events IS 'Календарь событий ЖК - собрания, субботники, праздники';
COMMENT ON TABLE event_registrations IS 'Регистрации пользователей на события';
COMMENT ON TABLE banners IS 'Система баннеров для рекламы';
COMMENT ON TABLE parking_spots IS 'Места парковки в подземном гараже';
COMMENT ON TABLE parking_history IS 'История использования мест парковки';

COMMENT ON COLUMN events.event_type IS 'Тип события: general, meeting, cleanup, celebration, repair';
COMMENT ON COLUMN events.status IS 'Статус события: active, cancelled, completed';
COMMENT ON COLUMN banners.position IS 'Позиция баннера: top_vertical, right_sidebar';
COMMENT ON COLUMN parking_spots.spot_type IS 'Тип места: regular, disabled, electric, reserved';
COMMENT ON COLUMN parking_history.action IS 'Действие: parked, left, reserved, freed';
