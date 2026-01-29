/*
  # Fix start_level2_stage to Set organization_id on Tasks

  1. Problem
    - start_level2_stage creates tasks without organization_id
    - Tasks with NULL organization_id don't appear in frontend (realtime filter)
    - Existing tasks for AlmaU and other projects are broken

  2. Solution
    - Update function to get organization_id from project
    - Set organization_id when creating tasks
    - Backfill existing tasks with NULL organization_id

  3. Changes
    - Add organization_id to task INSERT
    - Get organization_id from projects table
    - Backfill existing tasks
*/

-- Drop and recreate function with organization_id support
DROP FUNCTION IF EXISTS start_level2_stage(uuid) CASCADE;

CREATE OR REPLACE FUNCTION start_level2_stage(p_stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  stage_record RECORD;
  template_task RECORD;
  project_member RECORD;
  stage_start_time timestamptz;
  current_deadline timestamptz;
  assigned_user_id uuid;
  v_organization_id uuid;
BEGIN
  -- Get stage info and set as active
  UPDATE project_roadmap_stages
  SET
    status = 'active',
    started_at = now()
  WHERE id = p_stage_id
  RETURNING project_id, template_stage_id, started_at, organization_id INTO stage_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found';
  END IF;

  -- Get organization_id from project if stage doesn't have it
  IF stage_record.organization_id IS NULL THEN
    SELECT organization_id INTO v_organization_id
    FROM projects
    WHERE id = stage_record.project_id;
  ELSE
    v_organization_id := stage_record.organization_id;
  END IF;

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

      -- Try to auto-assign based on job_title_required (text match)
      IF template_task.job_title_required IS NOT NULL THEN
        SELECT pm.user_id INTO assigned_user_id
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = stage_record.project_id
          AND u.job_title = template_task.job_title_required
          AND u.organization_id = v_organization_id
        LIMIT 1;
      END IF;

      -- Calculate waterfall deadline: current_deadline + task duration
      current_deadline := current_deadline + (COALESCE(template_task.duration_days, 3) || ' days')::interval;

      -- Create the task WITH organization_id
      INSERT INTO tasks (
        organization_id,
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
        v_organization_id,
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
    -- Manual stage without template: update deadlines for existing tasks
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
$$;

-- Backfill organization_id for existing tasks with NULL organization_id
-- Get organization_id from their project
UPDATE tasks t
SET organization_id = p.organization_id
FROM projects p
WHERE t.project_id = p.id
  AND t.organization_id IS NULL;

-- Backfill organization_id for project_roadmap_stages with NULL organization_id
UPDATE project_roadmap_stages prs
SET organization_id = p.organization_id
FROM projects p
WHERE prs.project_id = p.id
  AND prs.organization_id IS NULL;
