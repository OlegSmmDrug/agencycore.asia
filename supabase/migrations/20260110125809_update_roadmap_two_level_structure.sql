/*
  # Update Roadmap to Two-Level Structure

  ## Overview
  Updates roadmap system to support two-level stage hierarchy:
  - Level 1: Fixed stages (Подготовка, Продакшн, Запуск, Финал) - NOT editable
  - Level 2: Editable substages within Level 1 stages
  - Multiple templates per project support
  - Project team members

  ## Changes

  ### 1. Create `roadmap_stage_level1` table
  Fixed first-level stages that cannot be edited
  - `id` (uuid, primary key)
  - `name` (text) - Stage name
  - `order_index` (integer) - Display order
  - `color` (text) - Visual color
  - `icon` (text) - Icon for stage
  - `created_at` (timestamptz)

  ### 2. Update existing tables
  - Modify `project_roadmap_stages` to work as Level 2 stages
  - Add `level1_stage_id` reference
  - Add `project_members` table for team management
  - Add `project_roadmap_templates` for many-to-many relationship

  ## Security
  - Enable RLS on new tables
  - Allow authenticated users full access
*/

-- Create roadmap_stage_level1 table for fixed stages
CREATE TABLE IF NOT EXISTS roadmap_stage_level1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL,
  color text DEFAULT '#64748b',
  icon text DEFAULT '📋',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roadmap_stage_level1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read on roadmap_stage_level1"
  ON roadmap_stage_level1 FOR SELECT
  TO authenticated
  USING (true);

-- Insert fixed level 1 stages
INSERT INTO roadmap_stage_level1 (name, order_index, color, icon) VALUES
  ('Подготовка', 1, '#3b82f6', '🎯'),
  ('Продакшн', 2, '#8b5cf6', '⚡'),
  ('Запуск', 3, '#10b981', '🚀'),
  ('Финал', 4, '#f59e0b', '🏆')
ON CONFLICT DO NOTHING;

-- Add level1_stage_id to project_roadmap_stages (Level 2 stages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_stages' AND column_name = 'level1_stage_id'
  ) THEN
    ALTER TABLE project_roadmap_stages 
    ADD COLUMN level1_stage_id uuid REFERENCES roadmap_stage_level1(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on project_members"
  ON project_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create project_roadmap_templates for many-to-many relationship
CREATE TABLE IF NOT EXISTS project_roadmap_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  template_id uuid REFERENCES roadmap_templates(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, template_id)
);

ALTER TABLE project_roadmap_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on project_roadmap_templates"
  ON project_roadmap_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add stage_level2_id to tasks for better integration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'stage_level2_id'
  ) THEN
    ALTER TABLE tasks 
    ADD COLUMN stage_level2_id uuid REFERENCES project_roadmap_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_project_roadmap_stages_level1 
  ON project_roadmap_stages(level1_stage_id);

CREATE INDEX IF NOT EXISTS idx_project_roadmap_stages_project 
  ON project_roadmap_stages(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_stage_level2 
  ON tasks(stage_level2_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project 
  ON project_members(project_id);
