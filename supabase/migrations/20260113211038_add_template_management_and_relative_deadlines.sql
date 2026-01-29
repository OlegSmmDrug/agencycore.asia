/*
  # Template Management and Relative Deadlines System

  ## Overview
  Adds comprehensive template management and relative deadline functionality to the roadmap system.

  ## Changes

  ### 1. Update `roadmap_template_tasks` table
  - Add `duration_days` (integer) - Number of days to complete task from stage start
  - Remove dependency on absolute deadlines in templates

  ### 2. Update `roadmap_template_stages` table
  - Add `duration_days` (integer) - Expected duration of entire stage
  - Add `level1_stage_id` (uuid) - Link to Level 1 stage

  ### 3. Update `project_roadmap_stages` table
  - Add `status` (text) - Stage status: locked, active, completed
  - Add `started_at` (timestamptz) - When stage was activated
  - Add `completed_at` (timestamptz) - When stage was completed
  - Add `duration_days` (integer) - Planned duration

  ### 4. Update `tasks` table
  - Add `duration_days` (integer) - Relative deadline in days

  ### 5. Add functions
  - Function to start a Level 2 stage and calculate task deadlines
  - Function to complete a Level 2 stage and activate next one
  - Function to check if all tasks in stage are completed

  ## Security
  - All policies already exist for public access
*/

-- Add duration_days to roadmap_template_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_tasks' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE roadmap_template_tasks
    ADD COLUMN duration_days integer DEFAULT 3 CHECK (duration_days > 0);
  END IF;
END $$;

-- Add duration_days and level1_stage_id to roadmap_template_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_stages' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE roadmap_template_stages
    ADD COLUMN duration_days integer DEFAULT 7 CHECK (duration_days > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_stages' AND column_name = 'level1_stage_id'
  ) THEN
    ALTER TABLE roadmap_template_stages
    ADD COLUMN level1_stage_id uuid REFERENCES roadmap_stage_level1(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add status, started_at, completed_at, duration_days to project_roadmap_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_stages' AND column_name = 'status'
  ) THEN
    ALTER TABLE project_roadmap_stages
    ADD COLUMN status text DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_stages' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE project_roadmap_stages
    ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_stages' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE project_roadmap_stages
    ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_stages' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE project_roadmap_stages
    ADD COLUMN duration_days integer DEFAULT 7;
  END IF;
END $$;

-- Add duration_days to tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE tasks
    ADD COLUMN duration_days integer DEFAULT 3;
  END IF;
END $$;

-- Function to check if all tasks in a stage are completed
CREATE OR REPLACE FUNCTION check_stage_tasks_completed(stage_id uuid)
RETURNS boolean AS $$
DECLARE
  uncompleted_count integer;
BEGIN
  SELECT COUNT(*)
  INTO uncompleted_count
  FROM tasks
  WHERE stage_level2_id = stage_id
    AND status NOT IN ('Done', 'Approved');

  RETURN uncompleted_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to start a Level 2 stage (activate it and calculate task deadlines)
CREATE OR REPLACE FUNCTION start_level2_stage(stage_id uuid)
RETURNS void AS $$
DECLARE
  task_record RECORD;
  stage_start_time timestamptz;
BEGIN
  -- Set stage as active and record start time
  UPDATE project_roadmap_stages
  SET
    status = 'active',
    started_at = now()
  WHERE id = stage_id
  RETURNING started_at INTO stage_start_time;

  -- Calculate deadlines for all tasks in this stage
  FOR task_record IN
    SELECT id, duration_days
    FROM tasks
    WHERE stage_level2_id = stage_id
  LOOP
    UPDATE tasks
    SET deadline = stage_start_time + (COALESCE(task_record.duration_days, 3) || ' days')::interval
    WHERE id = task_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a Level 2 stage and activate the next one
CREATE OR REPLACE FUNCTION complete_level2_stage(stage_id uuid)
RETURNS jsonb AS $$
DECLARE
  current_stage RECORD;
  next_stage_id uuid;
  result jsonb;
BEGIN
  -- Get current stage info
  SELECT project_id, level1_stage_id, order_index
  INTO current_stage
  FROM project_roadmap_stages
  WHERE id = stage_id;

  -- Mark current stage as completed
  UPDATE project_roadmap_stages
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = stage_id;

  -- Find next stage in the same Level 1
  SELECT id INTO next_stage_id
  FROM project_roadmap_stages
  WHERE project_id = current_stage.project_id
    AND level1_stage_id = current_stage.level1_stage_id
    AND order_index > current_stage.order_index
    AND status = 'locked'
  ORDER BY order_index
  LIMIT 1;

  -- If found, activate it
  IF next_stage_id IS NOT NULL THEN
    PERFORM start_level2_stage(next_stage_id);
    result := jsonb_build_object(
      'success', true,
      'next_stage_id', next_stage_id,
      'message', 'Stage completed and next stage activated'
    );
  ELSE
    -- Check if this was the last stage in Level 1
    result := jsonb_build_object(
      'success', true,
      'next_stage_id', null,
      'message', 'Stage completed. This was the last stage in this phase.'
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to complete Level 1 stage and activate next Level 1
CREATE OR REPLACE FUNCTION complete_level1_stage(project_id uuid, level1_stage_id uuid)
RETURNS jsonb AS $$
DECLARE
  current_level1_status RECORD;
  next_level1_id uuid;
  first_stage_in_next_level1 uuid;
  result jsonb;
BEGIN
  -- Get current Level 1 stage info
  SELECT order_index
  INTO current_level1_status
  FROM project_level1_stage_status
  WHERE project_level1_stage_status.project_id = complete_level1_stage.project_id
    AND project_level1_stage_status.level1_stage_id = complete_level1_stage.level1_stage_id;

  -- Mark Level 1 stage as completed
  UPDATE project_level1_stage_status
  SET
    status = 'completed',
    completed_at = now()
  WHERE project_level1_stage_status.project_id = complete_level1_stage.project_id
    AND project_level1_stage_status.level1_stage_id = complete_level1_stage.level1_stage_id;

  -- Find next Level 1 stage
  SELECT level1_stage_id INTO next_level1_id
  FROM project_level1_stage_status
  WHERE project_level1_stage_status.project_id = complete_level1_stage.project_id
    AND order_index > current_level1_status.order_index
    AND status = 'locked'
  ORDER BY order_index
  LIMIT 1;

  -- If found, activate it
  IF next_level1_id IS NOT NULL THEN
    UPDATE project_level1_stage_status
    SET
      status = 'active',
      started_at = now()
    WHERE project_level1_stage_status.project_id = complete_level1_stage.project_id
      AND project_level1_stage_status.level1_stage_id = next_level1_id;

    -- Find and activate first Level 2 stage in new Level 1
    SELECT id INTO first_stage_in_next_level1
    FROM project_roadmap_stages
    WHERE project_roadmap_stages.project_id = complete_level1_stage.project_id
      AND project_roadmap_stages.level1_stage_id = next_level1_id
      AND status = 'locked'
    ORDER BY order_index
    LIMIT 1;

    IF first_stage_in_next_level1 IS NOT NULL THEN
      PERFORM start_level2_stage(first_stage_in_next_level1);
    END IF;

    result := jsonb_build_object(
      'success', true,
      'next_level1_id', next_level1_id,
      'message', 'Level 1 phase completed and next phase activated'
    );
  ELSE
    result := jsonb_build_object(
      'success', true,
      'next_level1_id', null,
      'message', 'Level 1 phase completed. This was the final phase.'
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_roadmap_stages_status
  ON project_roadmap_stages(project_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_stage_status
  ON tasks(stage_level2_id, status);

CREATE INDEX IF NOT EXISTS idx_roadmap_template_stages_level1
  ON roadmap_template_stages(level1_stage_id);
