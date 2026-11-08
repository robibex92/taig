-- История разборов выгрузок ГИС ЖКХ по голосованию (бандл Б).
-- Оригиналы файлов не храним — только разобранные строки (решение от 08.11).

-- Один срез: одно голосование одного дома на одну дату выгрузки.
CREATE TABLE IF NOT EXISTS gis_vote_reports (
  id BIGSERIAL PRIMARY KEY,
  house VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  exported_at DATE NOT NULL,
  file_name VARCHAR(255),
  address TEXT,
  house_fias VARCHAR(40),
  inn VARCHAR(20),
  management_company VARCHAR(255),
  ownership_rows INTEGER NOT NULL DEFAULT 0,
  rooms_total INTEGER NOT NULL DEFAULT 0,
  area_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rooms_base INTEGER NOT NULL DEFAULT 0,
  area_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
  area_common NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rooms_voted INTEGER NOT NULL DEFAULT 0,
  owners_voted INTEGER NOT NULL DEFAULT 0,
  weight_voted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  defects JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_gis_vote_reports_house_title_date UNIQUE (house, title, exported_at)
);

-- Помещения среза. Ключ — кадастровый номер; у строк без него cadastre IS NULL,
-- и они остаются отдельными помещениями, а не сливаются по пустому ключу.
CREATE TABLE IF NOT EXISTS gis_vote_report_rooms (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES gis_vote_reports(id) ON DELETE CASCADE,
  cadastre VARCHAR(64),
  room_label VARCHAR(64),
  kind VARCHAR(32) NOT NULL,
  in_base BOOLEAN NOT NULL DEFAULT true,
  owners INTEGER NOT NULL DEFAULT 1,
  area NUMERIC(10, 2) NOT NULL DEFAULT 0,
  weight NUMERIC(10, 2) NOT NULL DEFAULT 0,
  share_sum NUMERIC(6, 4),
  voted BOOLEAN NOT NULL DEFAULT false,
  last_bulletin_date DATE
);

CREATE INDEX IF NOT EXISTS idx_gis_vote_reports_house_title ON gis_vote_reports(house, title);
CREATE INDEX IF NOT EXISTS idx_gis_vote_report_rooms_report_id ON gis_vote_report_rooms(report_id);
CREATE INDEX IF NOT EXISTS idx_gis_vote_report_rooms_cadastre ON gis_vote_report_rooms(cadastre);
