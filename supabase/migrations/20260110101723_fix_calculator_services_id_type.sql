/*
  # Fix calculator_services table ID type

  1. Changes
    - Drop existing calculator_services table
    - Recreate with text ID instead of UUID
    - Repopulate with default services
*/

-- Drop existing table
DROP TABLE IF EXISTS calculator_services CASCADE;

-- Create calculator_services table with text ID
CREATE TABLE calculator_services (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('checkbox', 'counter', 'range')),
  icon text NOT NULL DEFAULT '✨',
  category text NOT NULL CHECK (category IN ('smm', 'target', 'sites', 'video')),
  max_value integer,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE calculator_services ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view calculator services"
  ON calculator_services
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert calculator services"
  ON calculator_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update calculator services"
  ON calculator_services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete calculator services"
  ON calculator_services
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert default services
INSERT INTO calculator_services (id, name, price, type, icon, category, max_value, sort_order) VALUES
  ('smm_1', 'Посты в ленту', 8000, 'range', '🎨', 'smm', 30, 1),
  ('smm_2', 'Stories (Серии)', 3500, 'range', '📱', 'smm', 120, 2),
  ('smm_3', 'Reels Production', 15000, 'counter', '🎬', 'smm', 20, 3),
  ('tar_1', 'Запуск рекламной кампании', 120000, 'checkbox', '🚀', 'target', NULL, 4),
  ('site_1', 'Landing Page Premium', 250000, 'checkbox', '💎', 'sites', NULL, 5),
  ('vid_1', 'Проф. видеосъемка (день)', 180000, 'counter', '🎥', 'video', 7, 6);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE calculator_services;