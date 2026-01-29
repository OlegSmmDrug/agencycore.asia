/*
  # Create services management system

  ## Summary
  This migration creates a services table to manage agency services that can be assigned to clients and projects.

  ## New Tables
  
  ### `services`
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, unique, not null) - Service name (e.g., "SMM", "Таргетированная реклама")
  - `description` (text) - Optional service description
  - `is_active` (boolean, default true) - Whether service is active
  - `sort_order` (integer, default 0) - Display order
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on services table
  - Allow authenticated users to read all services
  - Only authenticated users can create/update services

  ## Notes
  - Services replace the hardcoded DEFAULT_SERVICES constant
  - Services can be assigned to clients via the services array field
  - Initial services are seeded based on existing DEFAULT_SERVICES
*/

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read all services"
  ON services
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert services"
  ON services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
  ON services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete services"
  ON services
  FOR DELETE
  TO authenticated
  USING (true);

-- Seed initial services from DEFAULT_SERVICES
INSERT INTO services (name, sort_order) VALUES
  ('SMM', 1),
  ('Таргетированная реклама', 2),
  ('Контекстная реклама', 3),
  ('SEO', 4),
  ('Веб-разработка', 5),
  ('Брендинг', 6),
  ('Видеопроизводство', 7),
  ('Фотосъемка', 8),
  ('Копирайтинг', 9),
  ('Дизайн', 10),
  ('PR', 11),
  ('Консалтинг', 12)
ON CONFLICT (name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_sort_order ON services(sort_order);