/*
  # Add Foreign Key Indexes and Security Cleanup
  
  This migration addresses remaining security and performance issues:
  
  ## 1. Foreign Key Indexes (Performance)
  - Add indexes for ~55 unindexed foreign keys
  - Improves JOIN query performance significantly
  
  ## 2. Unused Indexes Cleanup
  - Remove unused indexes to improve write performance
  
  ## 3. Duplicate RLS Policies
  - Remove duplicate permissive policies that cause confusion
  
  ## Security Note
  RLS is intentionally disabled for most tables as this application uses
  custom authentication (password-based) instead of Supabase Auth.
  Organization isolation is handled at the application layer.
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Activity log
CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id 
  ON activity_log(organization_id);

-- Automation rules
CREATE INDEX IF NOT EXISTS idx_automation_rules_organization_id 
  ON automation_rules(organization_id);

-- Company settings
CREATE INDEX IF NOT EXISTS idx_company_settings_organization_id 
  ON company_settings(organization_id);

-- Contract instances
CREATE INDEX IF NOT EXISTS idx_contract_instances_client_id 
  ON contract_instances(client_id);
CREATE INDEX IF NOT EXISTS idx_contract_instances_organization_id 
  ON contract_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_instances_template_id 
  ON contract_instances(template_id);

-- Contract templates
CREATE INDEX IF NOT EXISTS idx_contract_templates_organization_id 
  ON contract_templates(organization_id);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_author_id 
  ON documents(author_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id 
  ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id 
  ON documents(parent_id);

-- Executor company info
CREATE INDEX IF NOT EXISTS idx_executor_company_info_organization_id 
  ON executor_company_info(organization_id);

-- Guest access
CREATE INDEX IF NOT EXISTS idx_guest_access_created_by 
  ON guest_access(created_by);
CREATE INDEX IF NOT EXISTS idx_guest_access_organization_id 
  ON guest_access(organization_id);

-- Guest project access
CREATE INDEX IF NOT EXISTS idx_guest_project_access_access_token_id 
  ON guest_project_access(access_token_id);
CREATE INDEX IF NOT EXISTS idx_guest_project_access_organization_id 
  ON guest_project_access(organization_id);

-- Guest users
CREATE INDEX IF NOT EXISTS idx_guest_users_organization_id 
  ON guest_users(organization_id);

-- Integration API calls
CREATE INDEX IF NOT EXISTS idx_integration_api_calls_integration_id 
  ON integration_api_calls(integration_id);

-- KPI presets
CREATE INDEX IF NOT EXISTS idx_kpi_presets_organization_id 
  ON kpi_presets(organization_id);

-- Notes
CREATE INDEX IF NOT EXISTS idx_notes_author_id 
  ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_client_id 
  ON notes(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_organization_id 
  ON notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id 
  ON notes(project_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id 
  ON notifications(organization_id);

-- Organization subscriptions
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id 
  ON organization_subscriptions(plan_id);

-- Project expenses
CREATE INDEX IF NOT EXISTS idx_project_expenses_organization_id 
  ON project_expenses(organization_id);

-- Project expenses history
CREATE INDEX IF NOT EXISTS idx_project_expenses_history_expense_id 
  ON project_expenses_history(expense_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_history_organization_id 
  ON project_expenses_history(organization_id);

-- Project legal documents
CREATE INDEX IF NOT EXISTS idx_project_legal_documents_organization_id 
  ON project_legal_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_legal_documents_uploaded_by 
  ON project_legal_documents(uploaded_by);

-- Project level1 stage status
CREATE INDEX IF NOT EXISTS idx_project_level1_stage_status_level1_stage_id 
  ON project_level1_stage_status(level1_stage_id);
CREATE INDEX IF NOT EXISTS idx_project_level1_stage_status_organization_id 
  ON project_level1_stage_status(organization_id);

-- Project members
CREATE INDEX IF NOT EXISTS idx_project_members_organization_id 
  ON project_members(organization_id);

-- Project roadmap stages
CREATE INDEX IF NOT EXISTS idx_project_roadmap_stages_organization_id 
  ON project_roadmap_stages(organization_id);

-- Project roadmap templates
CREATE INDEX IF NOT EXISTS idx_project_roadmap_templates_organization_id 
  ON project_roadmap_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_roadmap_templates_template_id 
  ON project_roadmap_templates(template_id);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_roadmap_template_id 
  ON projects(roadmap_template_id);

-- Roadmap template stages
CREATE INDEX IF NOT EXISTS idx_roadmap_template_stages_level1_stage_id 
  ON roadmap_template_stages(level1_stage_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_template_stages_organization_id 
  ON roadmap_template_stages(organization_id);

-- Roadmap template tasks
CREATE INDEX IF NOT EXISTS idx_roadmap_template_tasks_organization_id 
  ON roadmap_template_tasks(organization_id);

-- Roadmap templates
CREATE INDEX IF NOT EXISTS idx_roadmap_templates_organization_id 
  ON roadmap_templates(organization_id);

-- Service calculator items
CREATE INDEX IF NOT EXISTS idx_service_calculator_items_organization_id 
  ON service_calculator_items(organization_id);

-- Services
CREATE INDEX IF NOT EXISTS idx_services_organization_id 
  ON services(organization_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_created_by 
  ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_organization_id 
  ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id 
  ON transactions(project_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_organization_id 
  ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_team_lead_id 
  ON users(team_lead_id);

-- Wazzup channels
CREATE INDEX IF NOT EXISTS idx_wazzup_channels_organization_id 
  ON wazzup_channels(organization_id);

-- Webhook endpoints
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_organization_id 
  ON webhook_endpoints(organization_id);

-- Webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_organization_id 
  ON webhook_logs(organization_id);

-- WhatsApp chats
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_client_id 
  ON whatsapp_chats(client_id);

-- WhatsApp templates
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_created_by 
  ON whatsapp_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_organization_id 
  ON whatsapp_templates(organization_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_payroll_records_org_user_month;
DROP INDEX IF EXISTS idx_automation_rules_created_by;

-- =====================================================
-- 3. REMOVE DUPLICATE RLS POLICIES
-- =====================================================

-- Keep only the more specific "view" policies, remove generic "manage" policies
-- as they have USING (true) which is a security risk

-- Automation rules - remove generic manage policy
DROP POLICY IF EXISTS "Users can manage automation rules in their organization" ON automation_rules;

-- Bonus rules - remove generic "all operations" policies
DROP POLICY IF EXISTS "Allow all operations on bonus_rules" ON bonus_rules;

-- Integration credentials - remove generic manage policy
DROP POLICY IF EXISTS "Users can manage credentials in their organization" ON integration_credentials;

-- Integrations - remove generic manage policy
DROP POLICY IF EXISTS "Users can manage integrations in their organization" ON integrations;

-- Webhook endpoints - remove generic manage policy
DROP POLICY IF EXISTS "Users can manage webhook endpoints in their organization" ON webhook_endpoints;