/*
  # Fix Remaining Function Security Issues (v2)
  
  This migration fixes the remaining database functions with mutable search_path
  to protect against SQL injection attacks.
  
  ## Functions Fixed
  - set_integration_credential
  - get_integration_credential
  - delete_integration_credentials
  - start_level2_stage
  - get_platform_statistics
  - get_organizations_list
*/

-- =====================================================
-- DROP AND RECREATE INTEGRATION CREDENTIAL FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS set_integration_credential(uuid, uuid, text, text, boolean);
DROP FUNCTION IF EXISTS get_integration_credential(uuid, uuid, text);
DROP FUNCTION IF EXISTS delete_integration_credentials(uuid, uuid);

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

-- =====================================================
-- DROP AND RECREATE STAGE MANAGEMENT FUNCTION
-- =====================================================

DROP FUNCTION IF EXISTS start_level2_stage(uuid, uuid, uuid);

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

-- =====================================================
-- DROP AND RECREATE SUPER ADMIN STATISTICS FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS get_platform_statistics();
DROP FUNCTION IF EXISTS get_organizations_list();

CREATE FUNCTION get_platform_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_orgs integer;
  active_orgs integer;
  total_users integer;
  total_projects integer;
  total_tasks integer;
  revenue numeric;
BEGIN
  SELECT COUNT(*) INTO total_orgs FROM organizations;
  
  SELECT COUNT(DISTINCT o.id) INTO active_orgs
  FROM organizations o
  INNER JOIN users u ON u.organization_id = o.id
  WHERE u.last_login > NOW() - INTERVAL '30 days';
  
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO total_projects FROM projects;
  SELECT COUNT(*) INTO total_tasks FROM tasks;
  
  SELECT COALESCE(SUM(monthly_price), 0) INTO revenue
  FROM organization_subscriptions os
  INNER JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.status = 'active';
  
  RETURN json_build_object(
    'total_organizations', total_orgs,
    'active_organizations', active_orgs,
    'total_users', total_users,
    'total_projects', total_projects,
    'total_tasks', total_tasks,
    'monthly_revenue', revenue
  );
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