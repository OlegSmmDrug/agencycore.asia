/*
  # Fix Ambiguous Column Reference in start_level2_stage

  ## Problem
  The function parameter 'stage_id' conflicts with the 'stage_id' column 
  in roadmap_template_tasks table, causing "column reference is ambiguous" error.

  ## Solution
  Rename the function parameter from 'stage_id' to 'p_stage_id' to avoid ambiguity.

  ## Changes
  - Replace start_level2_stage function with fixed version
  - All references to parameter now use 'p_stage_id'
*/

-- Drop existing function
DROP FUNCTION IF EXISTS start_level2_stage(uuid);

-- Create fixed function with renamed parameter
CREATE OR REPLACE FUNCTION start_level2_stage(p_stage_id uuid)
RETURNS void AS $$
DECLARE
  stage_record RECORD;
  template_task RECORD;
  project_member RECORD;
  stage_start_time timestamptz;
  current_deadline timestamptz;
  assigned_user_id uuid;
BEGIN
  -- Get stage info and set as active
  UPDATE project_roadmap_stages
  SET
    status = 'active',
    started_at = now()
  WHERE id = p_stage_id
  RETURNING project_id, template_stage_id, started_at INTO stage_record;

  stage_start_time := stage_record.started_at;
  current_deadline := stage_start_time;

  -- Check if this is a template-based stage
  IF stage_record.template_stage_id IS NOT NULL THEN
    -- Create tasks from template with waterfall deadlines
    FOR template_task IN
      SELECT *
      FROM roadmap_template_tasks
      WHERE stage_id = stage_record.template_stage_id
      ORDER BY order_index ASC
    LOOP
      assigned_user_id := NULL;

      -- Try to auto-assign based on job_title_required
      IF template_task.job_title_required IS NOT NULL THEN
        SELECT pm.user_id INTO assigned_user_id
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = stage_record.project_id
          AND u.job_title = template_task.job_title_required
        LIMIT 1;
      END IF;

      -- Calculate waterfall deadline: current_deadline + task duration
      current_deadline := current_deadline + (COALESCE(template_task.duration_days, 3) || ' days')::interval;

      -- Create the task
      INSERT INTO tasks (
        project_id,
        stage_level2_id,
        title,
        description,
        tags,
        estimated_hours,
        duration_days,
        status,
        priority,
        assignee_id,
        auto_assigned,
        deadline,
        created_at
      ) VALUES (
        stage_record.project_id,
        p_stage_id,
        template_task.title,
        COALESCE(template_task.description,
          CASE
            WHEN template_task.job_title_required IS NOT NULL
            THEN 'Требуется: ' || template_task.job_title_required
            ELSE ''
          END),
        CASE
          WHEN template_task.tags IS NOT NULL AND array_length(template_task.tags, 1) > 0
          THEN template_task.tags
          WHEN template_task.job_title_required IS NOT NULL
          THEN ARRAY[template_task.job_title_required]
          ELSE ARRAY[]::text[]
        END,
        template_task.estimated_hours,
        template_task.duration_days,
        'To Do',
        'Medium',
        assigned_user_id,
        (assigned_user_id IS NOT NULL),
        current_deadline,
        now()
      );
    END LOOP;
  ELSE
    -- Manual stage without template: use existing logic for manual tasks
    FOR template_task IN
      SELECT id, duration_days
      FROM tasks
      WHERE stage_level2_id = p_stage_id
      ORDER BY created_at ASC
    LOOP
      -- Calculate waterfall deadline for existing tasks
      current_deadline := current_deadline + (COALESCE(template_task.duration_days, 3) || ' days')::interval;

      UPDATE tasks
      SET deadline = current_deadline
      WHERE id = template_task.id;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;