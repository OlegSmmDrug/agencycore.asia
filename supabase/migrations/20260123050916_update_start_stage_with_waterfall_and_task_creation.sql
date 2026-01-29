/*
  # Update start_level2_stage for Waterfall Task Creation

  This migration updates the stage activation logic to support:

  1. Changes
    - Replace start_level2_stage function with new logic
    - Auto-create tasks from template when stage starts
    - Implement waterfall deadline calculation (sequential)
    - Auto-assign executors by job_title_required
    - Support both template-based and manual stages

  2. Behavior
    - When stage with template_stage_id is started:
      - Load tasks from roadmap_template_tasks
      - Create real tasks in tasks table
      - Auto-assign users by matching job_title with project members
      - Calculate deadlines in waterfall (each task starts after previous ends)
    - When manual stage is started (no template):
      - Use existing logic for manual tasks
      - Calculate deadlines from stage start time

  3. Waterfall Logic
    - First task: starts at stage.started_at, ends at started_at + duration_days
    - Second task: starts at first task deadline, ends at start + duration_days
    - Continue sequentially for all tasks by order_index
*/

-- Drop existing function
DROP FUNCTION IF EXISTS start_level2_stage(uuid);

-- Create updated function with template support and waterfall calculation
CREATE OR REPLACE FUNCTION start_level2_stage(stage_id uuid)
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
  WHERE id = stage_id
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
        stage_id,
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
      WHERE stage_level2_id = stage_id
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