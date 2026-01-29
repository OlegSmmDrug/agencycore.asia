/*
  # Add Level 1 Stage Progression System

  1. New Tables
    - project_level1_stage_status
      - project_id (uuid, references projects)
      - level1_stage_id (uuid, references roadmap_stage_level1)
      - status (text: locked, active, completed)
      - started_at (timestamptz)
      - completed_at (timestamptz)
      - order_index (integer)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  2. Security
    - Enable RLS on project_level1_stage_status
    - Add policies for public access

  3. Functions
    - Function to auto-activate next stage when current is completed
*/

-- Create project_level1_stage_status table
CREATE TABLE IF NOT EXISTS project_level1_stage_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  level1_stage_id uuid NOT NULL REFERENCES roadmap_stage_level1(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, level1_stage_id)
);

-- Enable RLS
ALTER TABLE project_level1_stage_status ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to project_level1_stage_status"
  ON project_level1_stage_status
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to project_level1_stage_status"
  ON project_level1_stage_status
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to project_level1_stage_status"
  ON project_level1_stage_status
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from project_level1_stage_status"
  ON project_level1_stage_status
  FOR DELETE
  USING (true);

-- Function to activate next stage when current is completed
CREATE OR REPLACE FUNCTION activate_next_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- If a stage is being marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Set completed_at timestamp
    NEW.completed_at := now();
    
    -- Activate the next stage (if exists)
    UPDATE project_level1_stage_status
    SET 
      status = 'active',
      started_at = now(),
      updated_at = now()
    WHERE 
      project_id = NEW.project_id
      AND order_index = NEW.order_index + 1
      AND status = 'locked';
  END IF;
  
  -- If a stage is being activated
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    NEW.started_at := now();
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_activate_next_stage ON project_level1_stage_status;
CREATE TRIGGER trigger_activate_next_stage
  BEFORE UPDATE ON project_level1_stage_status
  FOR EACH ROW
  EXECUTE FUNCTION activate_next_stage();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_level1_stage_status_project 
  ON project_level1_stage_status(project_id);
CREATE INDEX IF NOT EXISTS idx_project_level1_stage_status_level1_stage 
  ON project_level1_stage_status(level1_stage_id);
CREATE INDEX IF NOT EXISTS idx_project_level1_stage_status_order 
  ON project_level1_stage_status(project_id, order_index);