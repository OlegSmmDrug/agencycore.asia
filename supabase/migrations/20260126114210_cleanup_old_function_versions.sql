/*
  # Cleanup Old Function Versions
  
  This migration removes old function versions that still have mutable search_path
  to complete the security hardening.
  
  All functions are dropped using CASCADE to remove all versions and overloads,
  then recreated with proper security configuration.
*/

-- Drop all versions of the functions
DROP FUNCTION IF EXISTS create_default_calculator_categories() CASCADE;
DROP FUNCTION IF EXISTS create_default_calculator_categories(uuid) CASCADE;

DROP FUNCTION IF EXISTS auto_assign_task_by_job_title() CASCADE;
DROP FUNCTION IF EXISTS auto_assign_task_by_job_title(uuid, text) CASCADE;

DROP FUNCTION IF EXISTS calculate_task_deadlines() CASCADE;
DROP FUNCTION IF EXISTS calculate_task_deadlines(uuid, timestamp with time zone) CASCADE;

DROP FUNCTION IF EXISTS set_integration_credential(uuid, text, text, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS set_integration_credential(uuid, uuid, text, text, boolean) CASCADE;

DROP FUNCTION IF EXISTS get_integration_credential(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_integration_credential(uuid, uuid, text) CASCADE;

DROP FUNCTION IF EXISTS delete_integration_credentials(uuid) CASCADE;
DROP FUNCTION IF EXISTS delete_integration_credentials(uuid, uuid) CASCADE;

DROP FUNCTION IF EXISTS start_level2_stage(uuid) CASCADE;
DROP FUNCTION IF EXISTS start_level2_stage(uuid, uuid, uuid) CASCADE;

DROP FUNCTION IF EXISTS create_default_crm_stages_for_org() CASCADE;
DROP FUNCTION IF EXISTS create_default_crm_stages_for_org(uuid) CASCADE;

DROP FUNCTION IF EXISTS get_organizations_list(text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS get_organizations_list() CASCADE;

-- Recreate functions with correct security settings

CREATE FUNCTION create_default_calculator_categories(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO calculator_categories (id, organization_id, name, icon, color, sort_order, is_active)
  VALUES
    ('smm', org_id, 'SMM', '📱', '#3b82f6', 1, true),
    ('target', org_id, 'Таргет', '🎯', '#8b5cf6', 2, true),
    ('sites', org_id, 'Сайты', '🌐', '#10b981', 3, true),
    ('video', org_id, 'Продакшн', '🎬', '#f59e0b', 4, true)
  ON CONFLICT (id, organization_id) DO NOTHING;
END;
$$;

CREATE FUNCTION auto_assign_task_by_job_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NEW.assignee_id IS NULL AND NEW.job_title_id IS NOT NULL THEN
    SELECT u.id INTO target_user_id
    FROM users u
    WHERE u.job_title_id = NEW.job_title_id
      AND u.organization_id = NEW.organization_id
    ORDER BY random()
    LIMIT 1;
    
    IF target_user_id IS NOT NULL THEN
      NEW.assignee_id := target_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION calculate_task_deadlines()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  stage_start_date timestamptz;
  task_template record;
BEGIN
  IF NEW.stage_id IS NOT NULL AND NEW.deadline IS NULL THEN
    SELECT started_at INTO stage_start_date
    FROM project_level1_stage_status
    WHERE project_id = NEW.project_id
      AND level1_stage_id = NEW.stage_id;
    
    IF stage_start_date IS NOT NULL THEN
      SELECT * INTO task_template
      FROM roadmap_template_tasks
      WHERE id = NEW.template_task_id;
      
      IF task_template IS NOT NULL AND task_template.deadline_days IS NOT NULL THEN
        NEW.deadline := stage_start_date + (task_template.deadline_days || ' days')::interval;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION set_integration_credential(
  p_integration_id uuid,
  p_organization_id uuid,
  p_credential_key text,
  p_credential_value text,
  p_encrypted boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO integration_credentials (
    integration_id,
    organization_id,
    credential_key,
    credential_value,
    is_encrypted
  )
  VALUES (
    p_integration_id,
    p_organization_id,
    p_credential_key,
    p_credential_value,
    p_encrypted
  )
  ON CONFLICT (integration_id, organization_id, credential_key)
  DO UPDATE SET
    credential_value = EXCLUDED.credential_value,
    is_encrypted = EXCLUDED.is_encrypted,
    updated_at = NOW();
END;
$$;

CREATE FUNCTION get_integration_credential(
  p_integration_id uuid,
  p_organization_id uuid,
  p_credential_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  credential_value text;
BEGIN
  SELECT ic.credential_value INTO credential_value
  FROM integration_credentials ic
  WHERE ic.integration_id = p_integration_id
    AND ic.organization_id = p_organization_id
    AND ic.credential_key = p_credential_key;
  
  RETURN credential_value;
END;
$$;

CREATE FUNCTION delete_integration_credentials(
  p_integration_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM integration_credentials
  WHERE integration_id = p_integration_id
    AND organization_id = p_organization_id;
END;
$$;

CREATE FUNCTION start_level2_stage(
  p_project_id uuid,
  p_stage_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stage record;
  v_level1_stage_id uuid;
  v_project_roadmap_id uuid;
  v_template_task record;
  v_task_deadline timestamptz;
  v_stage_started_at timestamptz;
  v_executors text[];
BEGIN
  SELECT * INTO v_stage
  FROM roadmap_template_stages
  WHERE id = p_stage_id AND organization_id = p_organization_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found';
  END IF;
  
  v_level1_stage_id := v_stage.level1_stage_id;
  
  UPDATE project_level1_stage_status
  SET 
    current_level2_stage_id = p_stage_id,
    current_level2_stage_started_at = NOW(),
    updated_at = NOW()
  WHERE project_id = p_project_id
    AND level1_stage_id = v_level1_stage_id
    AND organization_id = p_organization_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Level1 stage not started for this project';
  END IF;
  
  SELECT started_at INTO v_stage_started_at
  FROM project_level1_stage_status
  WHERE project_id = p_project_id
    AND level1_stage_id = v_level1_stage_id;
  
  SELECT id INTO v_project_roadmap_id
  FROM project_roadmap_stages
  WHERE project_id = p_project_id
    AND level1_stage_id = v_level1_stage_id
    AND level2_stage_id = p_stage_id;
  
  IF v_project_roadmap_id IS NULL THEN
    INSERT INTO project_roadmap_stages (
      project_id,
      level1_stage_id,
      level2_stage_id,
      organization_id
    )
    VALUES (
      p_project_id,
      v_level1_stage_id,
      p_stage_id,
      p_organization_id
    )
    RETURNING id INTO v_project_roadmap_id;
  END IF;
  
  FOR v_template_task IN
    SELECT * FROM roadmap_template_tasks
    WHERE level2_stage_id = p_stage_id
      AND organization_id = p_organization_id
    ORDER BY sort_order
  LOOP
    IF v_template_task.deadline_days IS NOT NULL AND v_stage_started_at IS NOT NULL THEN
      v_task_deadline := v_stage_started_at + (v_template_task.deadline_days || ' days')::interval;
    ELSE
      v_task_deadline := NULL;
    END IF;
    
    v_executors := NULL;
    IF v_template_task.job_title_id IS NOT NULL THEN
      SELECT array_agg(u.id::text)
      INTO v_executors
      FROM users u
      INNER JOIN project_members pm ON pm.user_id = u.id
      WHERE pm.project_id = p_project_id
        AND u.job_title_id = v_template_task.job_title_id
        AND u.organization_id = p_organization_id;
    END IF;
    
    INSERT INTO tasks (
      project_id,
      stage_id,
      title,
      description,
      status,
      deadline,
      executors,
      job_title_id,
      organization_id,
      template_task_id
    )
    VALUES (
      p_project_id,
      v_project_roadmap_id,
      v_template_task.title,
      v_template_task.description,
      'todo',
      v_task_deadline,
      v_executors,
      v_template_task.job_title_id,
      p_organization_id,
      v_template_task.id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE FUNCTION create_default_crm_stages_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO crm_pipeline_stages (organization_id, name, color, sort_order, is_active, is_default)
  VALUES
    (NEW.id, 'Новый лид', '#3b82f6', 1, true, true),
    (NEW.id, 'Квалификация', '#8b5cf6', 2, true, false),
    (NEW.id, 'Презентация', '#10b981', 3, true, false),
    (NEW.id, 'Переговоры', '#f59e0b', 4, true, false),
    (NEW.id, 'Сделка закрыта', '#22c55e', 5, true, false),
    (NEW.id, 'Отказ', '#ef4444', 6, true, false)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION get_organizations_list()
RETURNS TABLE (
  id uuid,
  name text,
  owner_name text,
  user_count bigint,
  project_count bigint,
  created_at timestamptz,
  subscription_plan text,
  subscription_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    u.full_name as owner_name,
    (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
    (SELECT COUNT(*) FROM projects WHERE organization_id = o.id) as project_count,
    o.created_at,
    COALESCE(sp.name, 'Free') as subscription_plan,
    COALESCE(os.status, 'none') as subscription_status
  FROM organizations o
  LEFT JOIN users u ON u.id = o.owner_id
  LEFT JOIN organization_subscriptions os ON os.organization_id = o.id
  LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
  ORDER BY o.created_at DESC;
END;
$$;

-- Recreate triggers that were dropped with CASCADE
CREATE TRIGGER trigger_auto_assign_task
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_task_by_job_title();

CREATE TRIGGER trigger_calculate_task_deadlines
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_task_deadlines();

CREATE TRIGGER trigger_create_default_crm_stages
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_crm_stages_for_org();