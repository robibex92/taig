-- Migration: Add Car Gallery and Admin Notes functionality
-- This migration adds support for:
-- 1. Car images gallery (CarImage table)
-- 2. Admin notes for cars (CarAdminNote table)
-- 3. Comments on car images (visible only to admin)

-- Create CarImage table for car photo gallery
CREATE TABLE IF NOT EXISTS car_images (
    id BIGSERIAL PRIMARY KEY,
    car_id BIGINT NOT NULL,
    image_url TEXT NOT NULL,
    comment TEXT,
    added_by_user_id BIGINT,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6),
    
    -- Foreign key constraints
    CONSTRAINT fk_car_images_car_id 
        FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
    CONSTRAINT fk_car_images_user_id 
        FOREIGN KEY (added_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create CarAdminNote table for admin-only notes about car ownership
CREATE TABLE IF NOT EXISTS car_admin_notes (
    id BIGSERIAL PRIMARY KEY,
    car_id BIGINT NOT NULL,
    note TEXT NOT NULL,
    created_by_admin_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6),
    
    -- Foreign key constraints
    CONSTRAINT fk_car_admin_notes_car_id 
        FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
    CONSTRAINT fk_car_admin_notes_admin_id 
        FOREIGN KEY (created_by_admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_car_images_car_id ON car_images(car_id);
CREATE INDEX IF NOT EXISTS idx_car_images_created_at ON car_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_admin_notes_car_id ON car_admin_notes(car_id);
CREATE INDEX IF NOT EXISTS idx_car_admin_notes_created_at ON car_admin_notes(created_at DESC);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to car_images table
DROP TRIGGER IF EXISTS update_car_images_updated_at ON car_images;
CREATE TRIGGER update_car_images_updated_at
    BEFORE UPDATE ON car_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to car_admin_notes table
DROP TRIGGER IF EXISTS update_car_admin_notes_updated_at ON car_admin_notes;
CREATE TRIGGER update_car_admin_notes_updated_at
    BEFORE UPDATE ON car_admin_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
