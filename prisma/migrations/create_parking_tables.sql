-- Создание таблиц для парковочных мест
CREATE TABLE IF NOT EXISTS parking_spots (
  id BIGSERIAL PRIMARY KEY,
  spot_number VARCHAR(10) NOT NULL UNIQUE,
  floor INTEGER NOT NULL DEFAULT 1,
  section VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'undefined',
  price VARCHAR(100),
  description TEXT,
  contact_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Создание таблицы истории изменений парковочных мест
CREATE TABLE IF NOT EXISTS parking_spot_history (
  id BIGSERIAL PRIMARY KEY,
  parking_spot_id BIGINT NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  changed_by_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  old_price VARCHAR(100),
  new_price VARCHAR(100),
  old_description TEXT,
  new_description TEXT,
  old_contact_info TEXT,
  new_contact_info TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Создание таблицы сообщений по парковочным местам
CREATE TABLE IF NOT EXISTS parking_messages (
  id BIGSERIAL PRIMARY KEY,
  parking_spot_id BIGINT NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_parking_spots_spot_number ON parking_spots(spot_number);
CREATE INDEX IF NOT EXISTS idx_parking_spots_owner_id ON parking_spots(owner_id);
CREATE INDEX IF NOT EXISTS idx_parking_spots_status ON parking_spots(status);
CREATE INDEX IF NOT EXISTS idx_parking_spots_is_active ON parking_spots(is_active);
CREATE INDEX IF NOT EXISTS idx_parking_spot_history_parking_spot_id ON parking_spot_history(parking_spot_id);
CREATE INDEX IF NOT EXISTS idx_parking_spot_history_changed_by_id ON parking_spot_history(changed_by_id);
CREATE INDEX IF NOT EXISTS idx_parking_messages_parking_spot_id ON parking_messages(parking_spot_id);
CREATE INDEX IF NOT EXISTS idx_parking_messages_sender_id ON parking_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_parking_messages_receiver_id ON parking_messages(receiver_id);
