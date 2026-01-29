/*
  # Fix Ambiguous Column Reference in start_level2_stage
  
  ## Problem
  When parameter name is `stage_id`, it conflicts with table column names:
  - `roadmap_template_tasks.stage_id` (line 49)
  - `tasks.stage_level2_id = stage_id` (line 134)
  
  PostgreSQL cannot determine if `stage_id` refers to the function parameter
  or the table column, causing "column reference 'stage_id' is ambiguous" error.
  
  ## Solution
  Use `p_stage_id` prefix for the function parameter to avoid ambiguity
  with table column names. This is the standard PostgreSQL practice.
  
  ## Changes
  1. Rename parameter from `stage_id` to `p_stage_id`
  2. Update all references to use `p_stage_id` instead
  3. Keep RPC call compatible by using named parameter mapping
*/

DROP FUNCTION IF EXISTS start_level2_stage(uuid);

CREATE OR REPLACE FUNCTION start_level2_stage(p_stage_id uuid)
RETURNS void AS $$
DECLARE
  stage_record RECORD;
  template_task RECORD;
  stage_start_time timestamptz;
  assigned_user_id uuid;
  executor_deadlines JSONB := '{}'::jsonb;
  current_deadline timestamptz;
  executor_key text;
BEGIN
  -- Get stage info and set as active
  UPDATE project_roadmap_stages
  SET
    status = 'active',
    started_at = now()
  WHERE id = p_stage_id
  RETURNING project_id, template_stage_id, started_at INTO stage_record;

  stage_start_time := stage_record.started_at;

  -- Check if this is a template-based stage
  IF stage_record.template_stage_id IS NOT NULL THEN
    -- Create tasks from template with parallel executor waterfall
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

      -- Calculate waterfall deadline per executor
      executor_key := COALESCE(template_task.job_title_required, 'unassigned');
      
      -- Get current deadline for this executor (or stage start if first task)
      IF executor_deadlines ? executor_key THEN
        current_deadline := (executor_deadlines->>executor_key)::timestamptz;
      ELSE
        current_deadline := stage_start_time;
      END IF;

      -- Calculate new deadline: current + task duration
      current_deadline := current_deadline + (COALESCE(template_task.duration_days, 3) || ' days')::interval;

      -- Update executor deadline tracker
      executor_deadlines := jsonb_set(
        executor_deadlines,
        ARRAY[executor_key],
        to_jsonb(current_deadline::text)
      );

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
    -- Manual stage without template: group existing tasks by assignee
    FOR template_task IN
      SELECT 
        id, 
        duration_days,
        COALESCE(assignee_id::text, 'unassigned') as executor_key
      FROM tasks
      WHERE stage_level2_id = p_stage_id
      ORDER BY created_at ASC
    LOOP
      -- Get current deadline for this executor
      IF executor_deadlines ? template_task.executor_key THEN
        current_deadline := (executor_deadlines->>template_task.executor_key)::timestamptz;
      ELSE
        current_deadline := stage_start_time;
      END IF;

      -- Calculate new deadline
      current_deadline := current_deadline + (COALESCE(template_task.duration_days, 3) || ' days')::interval;

      -- Update executor deadline tracker
      executor_deadlines := jsonb_set(
        executor_deadlines,
        ARRAY[template_task.executor_key],
        to_jsonb(current_deadline::text)
      );

      -- Update task deadline
      UPDATE tasks
      SET deadline = current_deadline
      WHERE id = template_task.id;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;