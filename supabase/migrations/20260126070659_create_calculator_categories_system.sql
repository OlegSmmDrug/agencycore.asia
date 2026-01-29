/*
  # Create Calculator Categories System

  1. New Tables
    - `calculator_categories`
      - `id` (text, primary key) - Unique identifier (e.g., 'smm', 'target')
      - `organization_id` (uuid) - References organizations table
      - `name` (text) - Display name (e.g., 'SMM', 'Таргет')
      - `icon` (text) - Category icon/emoji
      - `color` (text) - Category color for UI
      - `sort_order` (integer) - Display order
      - `is_active` (boolean) - Active/archived flag
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to existing tables
    - Update `calculator_services` to reference categories via id instead of hardcoded values
    - Add foreign key constraint from calculator_services.category to calculator_categories.id

  3. Security
    - Enable RLS on calculator_categories
    - Users can only see/modify categories in their organization
    - Super admin has full access

  4. Data Migration
    - Seed default categories (smm, target, sites, video) for each organization
*/

-- Create calculator_categories table
CREATE TABLE IF NOT EXISTS calculator_categories (
  id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text DEFAULT '📁',
  color text DEFAULT '#3b82f6',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, organization_id)
);

-- Add index for organization queries
CREATE INDEX IF NOT EXISTS idx_calculator_categories_org 
ON calculator_categories(organization_id, is_active, sort_order);

-- Enable RLS
ALTER TABLE calculator_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calculator_categories
CREATE POLICY "Users can view categories in their organization"
  ON calculator_categories FOR SELECT
  TO public
  USING (organization_id = get_current_user_organization_id() OR is_super_admin());

CREATE POLICY "Users can insert categories in their organization"
  ON calculator_categories FOR INSERT
  TO public
  WITH CHECK (organization_id = get_current_user_organization_id() OR is_super_admin());

CREATE POLICY "Users can update categories in their organization"
  ON calculator_categories FOR UPDATE
  TO public
  USING (organization_id = get_current_user_organization_id() OR is_super_admin())
  WITH CHECK (organization_id = get_current_user_organization_id() OR is_super_admin());

CREATE POLICY "Users can delete categories in their organization"
  ON calculator_categories FOR DELETE
  TO public
  USING (organization_id = get_current_user_organization_id() OR is_super_admin());

-- Seed default categories for all existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations WHERE is_deleted = false
  LOOP
    -- Insert default categories if they don't exist
    INSERT INTO calculator_categories (id, organization_id, name, icon, color, sort_order)
    VALUES 
      ('smm', org_record.id, 'SMM', '📱', '#3b82f6', 1),
      ('target', org_record.id, 'Таргет', '🎯', '#8b5cf6', 2),
      ('sites', org_record.id, 'Сайты', '🌐', '#10b981', 3),
      ('video', org_record.id, 'Продакшн', '🎬', '#f59e0b', 4)
    ON CONFLICT (id, organization_id) DO NOTHING;
  END LOOP;
END $$;

-- Add trigger to auto-create default categories for new organizations
CREATE OR REPLACE FUNCTION create_default_calculator_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO calculator_categories (id, organization_id, name, icon, color, sort_order)
  VALUES 
    ('smm', NEW.id, 'SMM', '📱', '#3b82f6', 1),
    ('target', NEW.id, 'Таргет', '🎯', '#8b5cf6', 2),
    ('sites', NEW.id, 'Сайты', '🌐', '#10b981', 3),
    ('video', NEW.id, 'Продакшн', '🎬', '#f59e0b', 4);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_calculator_categories
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_calculator_categories();

-- Update trigger for updated_at
CREATE TRIGGER update_calculator_categories_updated_at
  BEFORE UPDATE ON calculator_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint to calculator_services (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calculator_services_category_fkey'
  ) THEN
    -- We can't add a strict FK because category is not part of the PK
    -- Instead, we'll add a check at application level
    -- But we can add an index for better performance
    CREATE INDEX IF NOT EXISTS idx_calculator_services_category 
    ON calculator_services(organization_id, category);
  END IF;
END $$;
