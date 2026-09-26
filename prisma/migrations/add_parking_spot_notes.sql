-- Migration: Service notes for parking spots
-- Заметки администрации о месте (история обращений, договорённости, нарушения).
-- Читают и пишут только персонал (global:admin, global:moderator, parking:admin);
-- жителям они не отдаются ни в одном эндпоинте схемы паркинга.

CREATE TABLE IF NOT EXISTS parking_spot_notes (
    id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    note TEXT NOT NULL,
    created_by_admin_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6),

    CONSTRAINT fk_parking_spot_notes_spot_id
        FOREIGN KEY (spot_id) REFERENCES parking_spots(id) ON DELETE CASCADE,
    CONSTRAINT fk_parking_spot_notes_admin_id
        FOREIGN KEY (created_by_admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parking_spot_notes_spot_id ON parking_spot_notes(spot_id);
CREATE INDEX IF NOT EXISTS idx_parking_spot_notes_created_at ON parking_spot_notes(created_at DESC);

-- Функция триггера уже создана в add_car_gallery_and_admin_notes.sql; пересоздаём
-- идемпотентно на случай пустой базы.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_parking_spot_notes_updated_at ON parking_spot_notes;
CREATE TRIGGER update_parking_spot_notes_updated_at
    BEFORE UPDATE ON parking_spot_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
