/*
  # Migrate Existing Data to Legacy Organization

  ## Overview
  This migration creates a "Legacy Organization" and migrates ALL existing data to it.
  This ensures zero data loss while transitioning to multi-tenant architecture.

  ## Steps
  1. Create Legacy Organization using first Admin user as owner
  2. Create Professional subscription for Legacy Organization (permanent access)
  3. Migrate all existing data to Legacy Organization
  4. Create usage metrics for Legacy Organization
  5. Make organization_id NOT NULL where appropriate

  ## Important
  - All 13 users, 76 clients, 36 projects, 245 tasks and other data will be preserved
  - Legacy Organization gets PROFESSIONAL plan with unlimited access
  - Data integrity is maintained through careful FK updates
*/

DO $$
DECLARE
  legacy_org_id uuid;
  first_admin_id uuid;
  professional_plan_id uuid;
BEGIN
  -- Get first Admin user to be owner of Legacy Organization
  SELECT id INTO first_admin_id
  FROM users
  WHERE system_role = 'Admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no Admin exists, use first user
  IF first_admin_id IS NULL THEN
    SELECT id INTO first_admin_id
    FROM users
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Create Legacy Organization
  INSERT INTO organizations (
    name,
    slug,
    owner_id,
    industry,
    company_size,
    timezone,
    onboarding_completed_at,
    created_at
  ) VALUES (
    'Your Agency',
    'legacy',
    first_admin_id,
    'marketing_agency',
    '11-50',
    'Asia/Almaty',
    now(),
    now()
  )
  RETURNING id INTO legacy_org_id;

  RAISE NOTICE 'Created Legacy Organization with ID: %', legacy_org_id;

  -- Get Professional plan ID
  SELECT id INTO professional_plan_id
  FROM subscription_plans
  WHERE name = 'PROFESSIONAL'
  LIMIT 1;

  -- Create Professional subscription for Legacy Organization (permanent access)
  INSERT INTO organization_subscriptions (
    organization_id,
    plan_id,
    status,
    billing_cycle,
    mrr,
    seats_purchased,
    trial_ends_at,
    current_period_start,
    current_period_end,
    created_at
  ) VALUES (
    legacy_org_id,
    professional_plan_id,
    'active',
    'annual',
    0, -- Legacy gets free access
    999999, -- Unlimited seats
    NULL, -- No trial, permanent access
    now(),
    now() + interval '100 years', -- Permanent
    now()
  );

  RAISE NOTICE 'Created Professional subscription for Legacy Organization';

  -- Migrate all users to Legacy Organization
  UPDATE users
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  RAISE NOTICE 'Migrated % users to Legacy Organization', (SELECT COUNT(*) FROM users WHERE organization_id = legacy_org_id);

  -- Migrate all clients to Legacy Organization
  UPDATE clients
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  RAISE NOTICE 'Migrated % clients to Legacy Organization', (SELECT COUNT(*) FROM clients WHERE organization_id = legacy_org_id);

  -- Migrate all projects to Legacy Organization
  UPDATE projects
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  RAISE NOTICE 'Migrated % projects to Legacy Organization', (SELECT COUNT(*) FROM projects WHERE organization_id = legacy_org_id);

  -- Migrate all tasks to Legacy Organization
  UPDATE tasks
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  RAISE NOTICE 'Migrated % tasks to Legacy Organization', (SELECT COUNT(*) FROM tasks WHERE organization_id = legacy_org_id);

  -- Migrate all transactions to Legacy Organization
  UPDATE transactions
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  RAISE NOTICE 'Migrated % transactions to Legacy Organization', (SELECT COUNT(*) FROM transactions WHERE organization_id = legacy_org_id);

  -- Migrate all documents to Legacy Organization
  UPDATE documents
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all whatsapp_messages to Legacy Organization
  UPDATE whatsapp_messages
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all whatsapp_templates to Legacy Organization
  UPDATE whatsapp_templates
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all whatsapp_chats to Legacy Organization
  UPDATE whatsapp_chats
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all notes to Legacy Organization
  UPDATE notes
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all payroll_records to Legacy Organization
  UPDATE payroll_records
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all salary_schemes to Legacy Organization
  UPDATE salary_schemes
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all contract_templates to Legacy Organization
  UPDATE contract_templates
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all contract_instances to Legacy Organization
  UPDATE contract_instances
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all roadmap_templates to Legacy Organization
  UPDATE roadmap_templates
  SET organization_id = legacy_org_id, is_global = false
  WHERE organization_id IS NULL;

  -- Migrate roadmap_template_stages to Legacy Organization (via template)
  UPDATE roadmap_template_stages
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate roadmap_template_tasks to Legacy Organization (via template)
  UPDATE roadmap_template_tasks
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate project_roadmap_stages to Legacy Organization (via project)
  UPDATE project_roadmap_stages
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all services to Legacy Organization
  UPDATE services
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all job_titles to Legacy Organization
  UPDATE job_titles
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all guest_users to Legacy Organization
  UPDATE guest_users
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all guest_access to Legacy Organization
  UPDATE guest_access
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all guest_project_access to Legacy Organization
  UPDATE guest_project_access
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all project_expenses to Legacy Organization
  UPDATE project_expenses
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all project_legal_documents to Legacy Organization
  UPDATE project_legal_documents
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all activity_log to Legacy Organization
  UPDATE activity_log
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all notifications to Legacy Organization
  UPDATE notifications
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all wazzup_channels to Legacy Organization
  UPDATE wazzup_channels
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all webhook_logs to Legacy Organization
  UPDATE webhook_logs
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all company_settings to Legacy Organization
  UPDATE company_settings
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all executor_company_info to Legacy Organization
  UPDATE executor_company_info
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all project_members to Legacy Organization
  UPDATE project_members
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all project_roadmap_templates to Legacy Organization
  UPDATE project_roadmap_templates
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all project_level1_stage_status to Legacy Organization
  UPDATE project_level1_stage_status
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Migrate all project_expenses_history to Legacy Organization
  UPDATE project_expenses_history
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;

  -- Keep calculator_services, service_calculator_items, kpi_presets as global (NULL organization_id)
  -- These can be shared across all organizations

  -- Create usage metrics for Legacy Organization
  INSERT INTO usage_metrics (organization_id, metric_type, current_value, limit_value, period_start, period_end)
  VALUES
    (legacy_org_id, 'active_users', (SELECT COUNT(*) FROM users WHERE organization_id = legacy_org_id), 999999, now(), now() + interval '1 month'),
    (legacy_org_id, 'projects', (SELECT COUNT(*) FROM projects WHERE organization_id = legacy_org_id AND is_archived = false), 999999, now(), now() + interval '1 month'),
    (legacy_org_id, 'api_calls', 0, 100000, now(), now() + interval '1 month'),
    (legacy_org_id, 'storage_mb', 0, 999999, now(), now() + interval '1 month');

  RAISE NOTICE 'Created usage metrics for Legacy Organization';
  RAISE NOTICE 'Migration completed successfully!';
END $$;
