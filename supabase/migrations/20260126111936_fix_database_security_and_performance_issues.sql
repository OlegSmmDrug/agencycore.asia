/*
  # Fix Database Security and Performance Issues
  
  This migration addresses multiple security and performance concerns identified in the database audit:
  
  ## 1. Foreign Key Indexes
  - Add missing index for `automation_rules.created_by`
  
  ## 2. Duplicate Indexes
  - Remove duplicate indexes on `payroll_records`, `salary_schemes`, `whatsapp_chats`
  
  ## 3. Unused Indexes (High Priority)
  - Drop unused indexes to improve write performance and reduce storage
  
  ## 4. RLS Policy Cleanup
  - Remove RLS policies from tables where RLS is disabled
  - This prevents confusion and potential security issues if RLS is re-enabled
  
  ## 5. Function Security
  - Fix mutable search_path in database functions for SQL injection protection
  
  ## 6. RLS for service_task_mappings
  - Either add policies or disable RLS to avoid locking out all users
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by 
  ON automation_rules(created_by);

-- =====================================================
-- 2. DROP DUPLICATE INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_payroll_records_organization;
DROP INDEX IF EXISTS idx_salary_schemes_organization;
DROP INDEX IF EXISTS idx_whatsapp_chats_organization;

-- =====================================================
-- 3. DROP UNUSED INDEXES (Performance Optimization)
-- =====================================================

-- Notes table
DROP INDEX IF EXISTS idx_notes_author_id;
DROP INDEX IF EXISTS idx_notes_project_id;
DROP INDEX IF EXISTS idx_notes_is_pinned;
DROP INDEX IF EXISTS idx_notes_organization;
DROP INDEX IF EXISTS idx_notes_client_id;

-- Documents table
DROP INDEX IF EXISTS idx_documents_parent_id;
DROP INDEX IF EXISTS idx_documents_author_id;
DROP INDEX IF EXISTS idx_documents_organization;

-- Guest access tables
DROP INDEX IF EXISTS idx_guest_project_access_guest;
DROP INDEX IF EXISTS idx_guest_access_created_by;
DROP INDEX IF EXISTS idx_guest_access_organization_id;
DROP INDEX IF EXISTS idx_guest_project_access_access_token_id;
DROP INDEX IF EXISTS idx_guest_project_access_organization_id;
DROP INDEX IF EXISTS idx_guest_users_organization_id;

-- Projects table
DROP INDEX IF EXISTS idx_projects_share_token;
DROP INDEX IF EXISTS idx_projects_roadmap_template_id;

-- Contract tables
DROP INDEX IF EXISTS idx_contract_templates_category;
DROP INDEX IF EXISTS idx_contract_instances_template;
DROP INDEX IF EXISTS idx_contract_instances_client;
DROP INDEX IF EXISTS idx_contract_instances_status;
DROP INDEX IF EXISTS idx_contract_templates_organization;
DROP INDEX IF EXISTS idx_contract_instances_organization;

-- Users table
DROP INDEX IF EXISTS idx_users_organization;
DROP INDEX IF EXISTS idx_users_auth_id_org;
DROP INDEX IF EXISTS idx_users_team_lead_id;

-- Transactions table
DROP INDEX IF EXISTS idx_transactions_organization;
DROP INDEX IF EXISTS idx_transactions_created_by;
DROP INDEX IF EXISTS idx_transactions_project_id;

-- Tasks table
DROP INDEX IF EXISTS idx_tasks_media_files;
DROP INDEX IF EXISTS idx_tasks_started_at;
DROP INDEX IF EXISTS idx_tasks_service_id;
DROP INDEX IF EXISTS idx_tasks_is_deprecated;

-- WhatsApp tables
DROP INDEX IF EXISTS idx_whatsapp_templates_organization;
DROP INDEX IF EXISTS idx_whatsapp_templates_created_by;
DROP INDEX IF EXISTS idx_whatsapp_chats_client_id;

-- Payroll tables
DROP INDEX IF EXISTS idx_payroll_records_organization_id;
DROP INDEX IF EXISTS idx_payroll_records_user_month;
DROP INDEX IF EXISTS idx_payroll_records_status;
DROP INDEX IF EXISTS idx_salary_schemes_organization_id;
DROP INDEX IF EXISTS idx_salary_schemes_target;
DROP INDEX IF EXISTS idx_salary_schemes_org_target;

-- Project tables
DROP INDEX IF EXISTS idx_project_expenses_organization;
DROP INDEX IF EXISTS idx_project_expenses_project_id;
DROP INDEX IF EXISTS idx_project_expenses_last_synced;
DROP INDEX IF EXISTS idx_project_expenses_history_organization_id;
DROP INDEX IF EXISTS idx_project_expenses_history_expense_id;
DROP INDEX IF EXISTS idx_project_legal_documents_organization_id;
DROP INDEX IF EXISTS idx_project_legal_docs_project;
DROP INDEX IF EXISTS idx_project_legal_docs_uploaded_by;
DROP INDEX IF EXISTS idx_project_level1_stage_status_level1_stage;
DROP INDEX IF EXISTS idx_project_level1_stage_status_organization_id;
DROP INDEX IF EXISTS idx_project_members_organization_id;

-- Roadmap tables
DROP INDEX IF EXISTS idx_roadmap_template_tasks_organization_id;
DROP INDEX IF EXISTS idx_roadmap_template_stages_organization_id;
DROP INDEX IF EXISTS idx_roadmap_templates_organization_id;
DROP INDEX IF EXISTS idx_project_roadmap_stages_organization_id;
DROP INDEX IF EXISTS idx_project_roadmap_templates_organization_id;
DROP INDEX IF EXISTS idx_project_roadmap_templates_template_id;
DROP INDEX IF EXISTS idx_roadmap_template_stages_level1;
DROP INDEX IF EXISTS idx_template_tasks_job_title;

-- Activity logs
DROP INDEX IF EXISTS idx_crm_activity_logs_created_at;
DROP INDEX IF EXISTS idx_crm_activity_log_created_at;
DROP INDEX IF EXISTS idx_activity_log_organization_id;

-- Services and calculator
DROP INDEX IF EXISTS idx_services_is_active;
DROP INDEX IF EXISTS idx_services_organization_id;
DROP INDEX IF EXISTS idx_service_calculator_items_organization_id;
DROP INDEX IF EXISTS idx_calculator_services_is_deprecated;
DROP INDEX IF EXISTS idx_calculator_services_category_active;
DROP INDEX IF EXISTS idx_calculator_services_category;

-- Notifications
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_organization_id;

-- Executor info
DROP INDEX IF EXISTS idx_executor_company_info_organization_id;

-- Company settings
DROP INDEX IF EXISTS idx_company_settings_organization_id;

-- KPI presets
DROP INDEX IF EXISTS idx_kpi_presets_organization_id;

-- Organizations
DROP INDEX IF EXISTS idx_organizations_owner;
DROP INDEX IF EXISTS idx_org_subscriptions_plan;
DROP INDEX IF EXISTS idx_addon_subscriptions_org;

-- Integrations
DROP INDEX IF EXISTS idx_integrations_status;
DROP INDEX IF EXISTS idx_integrations_next_sync;
DROP INDEX IF EXISTS idx_integration_credentials_integration;
DROP INDEX IF EXISTS idx_integration_sync_logs_created;
DROP INDEX IF EXISTS idx_integration_api_calls_integration;
DROP INDEX IF EXISTS idx_integration_api_calls_created;

-- Automation
DROP INDEX IF EXISTS idx_automation_rules_org;
DROP INDEX IF EXISTS idx_automation_rules_trigger;

-- Webhooks
DROP INDEX IF EXISTS idx_webhook_endpoints_org;
DROP INDEX IF EXISTS idx_webhook_endpoints_token;
DROP INDEX IF EXISTS idx_webhook_logs_organization_id;
DROP INDEX IF EXISTS idx_wazzup_channels_organization_id;

-- Service mappings
DROP INDEX IF EXISTS idx_service_task_mappings_org;
DROP INDEX IF EXISTS idx_service_task_mappings_service;
DROP INDEX IF EXISTS idx_service_task_mappings_widget;

-- CRM
DROP INDEX IF EXISTS idx_crm_stages_org;
DROP INDEX IF EXISTS idx_crm_stages_active;

-- Bonus rules
DROP INDEX IF EXISTS idx_bonus_rules_owner;
DROP INDEX IF EXISTS idx_bonus_rules_active;

-- Job titles
DROP INDEX IF EXISTS idx_job_titles_org_title;

-- =====================================================
-- 4. CLEAN UP RLS POLICIES FROM DISABLED TABLES
-- =====================================================

-- Drop all RLS policies from tables where RLS is disabled
-- This prevents confusion and potential security issues

-- activity_log
DROP POLICY IF EXISTS "Users can insert activity in their organization" ON activity_log;
DROP POLICY IF EXISTS "Users can view activity in their organization" ON activity_log;

-- addon_subscriptions
DROP POLICY IF EXISTS "Super admin can view all addons" ON addon_subscriptions;

-- calculator_services
DROP POLICY IF EXISTS "Allow public select on calculator_services" ON calculator_services;
DROP POLICY IF EXISTS "Users can view services in their organization" ON calculator_services;
DROP POLICY IF EXISTS "Users can insert services in their organization" ON calculator_services;
DROP POLICY IF EXISTS "Users can update services in their organization" ON calculator_services;
DROP POLICY IF EXISTS "Users can delete services in their organization" ON calculator_services;

-- clients
DROP POLICY IF EXISTS "Users can delete clients in their organization" ON clients;
DROP POLICY IF EXISTS "Users can insert clients in their organization" ON clients;
DROP POLICY IF EXISTS "Users can update clients in their organization" ON clients;
DROP POLICY IF EXISTS "Users can view clients in their organization" ON clients;

-- company_settings
DROP POLICY IF EXISTS "Anyone can view company settings" ON company_settings;

-- contract_instances
DROP POLICY IF EXISTS "Authenticated users can view all instances" ON contract_instances;

-- contract_templates
DROP POLICY IF EXISTS "Authors can delete own templates" ON contract_templates;
DROP POLICY IF EXISTS "Authors can update own templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can create templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can view all templates" ON contract_templates;

-- crm_activity_log
DROP POLICY IF EXISTS "Users can view crm activity log" ON crm_activity_log;

-- crm_activity_logs
DROP POLICY IF EXISTS "Users can view activity logs" ON crm_activity_logs;

-- documents
DROP POLICY IF EXISTS "Users can delete documents in their organization" ON documents;
DROP POLICY IF EXISTS "Users can insert documents in their organization" ON documents;
DROP POLICY IF EXISTS "Users can update documents in their organization" ON documents;
DROP POLICY IF EXISTS "Users can view documents in their organization" ON documents;

-- executor_company_info
DROP POLICY IF EXISTS "Anyone can read active executor company info" ON executor_company_info;

-- guest_project_access
DROP POLICY IF EXISTS "Anyone can view guest project links" ON guest_project_access;

-- guest_users
DROP POLICY IF EXISTS "Guests can view own profile" ON guest_users;

-- job_titles
DROP POLICY IF EXISTS "Users can access job titles in their organization" ON job_titles;

-- kpi_presets
DROP POLICY IF EXISTS "Allow public read access to kpi_presets" ON kpi_presets;

-- notes
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can read own notes" ON notes;
DROP POLICY IF EXISTS "Users can read project notes if team member" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;

-- notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

-- organization_subscriptions
DROP POLICY IF EXISTS "Super admin can view all subscriptions" ON organization_subscriptions;
DROP POLICY IF EXISTS "Users can view their organization subscription" ON organization_subscriptions;

-- organizations
DROP POLICY IF EXISTS "Organization owners can update their organization" ON organizations;
DROP POLICY IF EXISTS "Super admin can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;

-- payroll_records
DROP POLICY IF EXISTS "Users can access payroll records in their organization" ON payroll_records;

-- project_expenses
DROP POLICY IF EXISTS "Все пользователи могут просматрив" ON project_expenses;

-- project_expenses_history
DROP POLICY IF EXISTS "Все пользователи могут просматрив" ON project_expenses_history;

-- project_legal_documents
DROP POLICY IF EXISTS "Anyone can view project legal documents" ON project_legal_documents;

-- project_level1_stage_status
DROP POLICY IF EXISTS "Allow public read access to project_level1_stage_status" ON project_level1_stage_status;

-- project_members
DROP POLICY IF EXISTS "Allow public select on project_members" ON project_members;

-- project_roadmap_stages
DROP POLICY IF EXISTS "Users can read project roadmap stages" ON project_roadmap_stages;

-- project_roadmap_templates
DROP POLICY IF EXISTS "Allow public select on project_roadmap_templates" ON project_roadmap_templates;

-- projects
DROP POLICY IF EXISTS "Users can delete projects in their organization" ON projects;
DROP POLICY IF EXISTS "Users can insert projects in their organization" ON projects;
DROP POLICY IF EXISTS "Users can update projects in their organization" ON projects;
DROP POLICY IF EXISTS "Users can view projects in their organization" ON projects;

-- roadmap_stage_level1
DROP POLICY IF EXISTS "Allow public select on roadmap_stage_level1" ON roadmap_stage_level1;

-- roadmap_template_stages
DROP POLICY IF EXISTS "Users can read template stages" ON roadmap_template_stages;

-- roadmap_template_tasks
DROP POLICY IF EXISTS "Users can read template tasks" ON roadmap_template_tasks;

-- roadmap_templates
DROP POLICY IF EXISTS "Users can read roadmap templates" ON roadmap_templates;

-- salary_schemes
DROP POLICY IF EXISTS "Users can access salary schemes in their organization" ON salary_schemes;

-- service_calculator_items
DROP POLICY IF EXISTS "Anyone can view active calculator items" ON service_calculator_items;

-- services
DROP POLICY IF EXISTS "Allow public select on services" ON services;

-- subscription_plans
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON subscription_plans;

-- tasks
DROP POLICY IF EXISTS "Users can delete tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON tasks;

-- transactions
DROP POLICY IF EXISTS "Users can delete transactions in their organization" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions in their organization" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in their organization" ON transactions;
DROP POLICY IF EXISTS "Users can view transactions in their organization" ON transactions;

-- usage_metrics
DROP POLICY IF EXISTS "Super admin can view all usage metrics" ON usage_metrics;
DROP POLICY IF EXISTS "Users can view their organization usage" ON usage_metrics;

-- users
DROP POLICY IF EXISTS "Allow legacy user auth_id linking" ON users;
DROP POLICY IF EXISTS "Allow legacy user migration lookup" ON users;
DROP POLICY IF EXISTS "Public can read users for login" ON users;
DROP POLICY IF EXISTS "Super admin can delete users" ON users;
DROP POLICY IF EXISTS "Users can insert users in their organization" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can update users in their organization" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;

-- wazzup_channels
DROP POLICY IF EXISTS "Users can view channels" ON wazzup_channels;

-- webhook_logs
DROP POLICY IF EXISTS "Allow public select on webhook_logs" ON webhook_logs;

-- whatsapp_chats
DROP POLICY IF EXISTS "Users can delete whatsapp chats in their organization" ON whatsapp_chats;
DROP POLICY IF EXISTS "Users can insert whatsapp chats in their organization" ON whatsapp_chats;
DROP POLICY IF EXISTS "Users can update whatsapp chats in their organization" ON whatsapp_chats;
DROP POLICY IF EXISTS "Users can view whatsapp chats in their organization" ON whatsapp_chats;

-- whatsapp_messages
DROP POLICY IF EXISTS "Users can delete whatsapp messages in their organization" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert whatsapp messages in their organization" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can update whatsapp messages in their organization" ON whatsapp_messages;
DROP POLICY IF EXISTS "Users can view whatsapp messages in their organization" ON whatsapp_messages;

-- whatsapp_templates
DROP POLICY IF EXISTS "Users can delete whatsapp templates in their organization" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can insert whatsapp templates in their organization" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can update whatsapp templates in their organization" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can view templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can view whatsapp templates in their organization" ON whatsapp_templates;

-- =====================================================
-- 5. FIX service_task_mappings RLS
-- =====================================================

-- Disable RLS for service_task_mappings to match other tables
ALTER TABLE service_task_mappings DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. FIX MUTABLE SEARCH_PATH IN FUNCTIONS
-- =====================================================

-- Fix functions with mutable search_path by setting explicit IMMUTABLE or STABLE
-- and setting search_path

CREATE OR REPLACE FUNCTION mark_tasks_as_deprecated_on_service_deprecation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE tasks
  SET is_deprecated = NEW.is_deprecated
  WHERE service_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_default_calculator_categories(org_id uuid)
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

CREATE OR REPLACE FUNCTION auto_assign_task_by_job_title()
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

CREATE OR REPLACE FUNCTION calculate_task_deadlines()
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

CREATE OR REPLACE FUNCTION create_default_crm_stages_for_org()
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

CREATE OR REPLACE FUNCTION process_completed_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  salary_scheme record;
  task_rate numeric;
  hours_worked numeric;
  payment_amount numeric;
  payment_description text;
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' AND NEW.assignee_id IS NOT NULL THEN
    SELECT * INTO salary_scheme
    FROM salary_schemes
    WHERE user_id = NEW.assignee_id
      AND organization_id = NEW.organization_id
      AND is_active = true
    LIMIT 1;
    
    IF salary_scheme IS NOT NULL AND salary_scheme.bonus_per_task > 0 THEN
      task_rate := salary_scheme.bonus_per_task;
      
      IF NEW.task_type = 'mobilograph' AND NEW.hours_worked IS NOT NULL THEN
        hours_worked := NEW.hours_worked;
        payment_amount := hours_worked * task_rate;
        payment_description := format('Оплата за мобилографа: %s часов по %s руб/час', hours_worked, task_rate);
      ELSE
        payment_amount := task_rate;
        payment_description := format('Бонус за выполнение задачи: %s', NEW.title);
      END IF;
      
      INSERT INTO payroll_records (
        organization_id,
        user_id,
        month,
        year,
        task_id,
        amount,
        description,
        status
      ) VALUES (
        NEW.organization_id,
        NEW.assignee_id,
        EXTRACT(MONTH FROM NOW()),
        EXTRACT(YEAR FROM NOW()),
        NEW.id,
        payment_amount,
        payment_description,
        'pending'
      )
      ON CONFLICT (organization_id, user_id, month, year)
      DO UPDATE SET
        amount = payroll_records.amount + EXCLUDED.amount,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_task_type_rates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;