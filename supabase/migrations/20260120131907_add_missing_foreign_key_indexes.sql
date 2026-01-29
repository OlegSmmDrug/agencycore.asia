/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Adds indexes for 42 unindexed foreign keys
    - Improves JOIN query performance
    - Prevents slow queries at scale
  
  2. Tables Affected
    - activity_log, calculator_services, company_settings
    - crm_activity_log, crm_activity_logs, executor_company_info
    - guest_access, guest_project_access, guest_users
    - job_titles, kpi_presets, notes, notifications
    - project_expenses, project_expenses_history
    - project_legal_documents, project_level1_stage_status
    - project_members, project_roadmap_stages
    - project_roadmap_templates, projects
    - roadmap_template_stages, roadmap_template_tasks
    - roadmap_templates, service_calculator_items
    - services, tasks, transactions, users
    - wazzup_channels, webhook_logs
    - whatsapp_messages, whatsapp_templates
*/

-- Activity log
CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON activity_log(organization_id);

-- Calculator services
CREATE INDEX IF NOT EXISTS idx_calculator_services_organization_id ON calculator_services(organization_id);

-- Company settings
CREATE INDEX IF NOT EXISTS idx_company_settings_organization_id ON company_settings(organization_id);

-- CRM activity log
CREATE INDEX IF NOT EXISTS idx_crm_activity_log_user_id ON crm_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_logs_user_id ON crm_activity_logs(user_id);

-- Executor company info
CREATE INDEX IF NOT EXISTS idx_executor_company_info_organization_id ON executor_company_info(organization_id);

-- Guest access
CREATE INDEX IF NOT EXISTS idx_guest_access_created_by ON guest_access(created_by);
CREATE INDEX IF NOT EXISTS idx_guest_access_organization_id ON guest_access(organization_id);

-- Guest project access
CREATE INDEX IF NOT EXISTS idx_guest_project_access_access_token_id ON guest_project_access(access_token_id);
CREATE INDEX IF NOT EXISTS idx_guest_project_access_organization_id ON guest_project_access(organization_id);

-- Guest users
CREATE INDEX IF NOT EXISTS idx_guest_users_organization_id ON guest_users(organization_id);

-- Job titles
CREATE INDEX IF NOT EXISTS idx_job_titles_organization_id ON job_titles(organization_id);

-- KPI presets
CREATE INDEX IF NOT EXISTS idx_kpi_presets_organization_id ON kpi_presets(organization_id);

-- Notes
CREATE INDEX IF NOT EXISTS idx_notes_client_id ON notes(client_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);

-- Project expenses
CREATE INDEX IF NOT EXISTS idx_project_expenses_created_by ON project_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_project_expenses_updated_by ON project_expenses(updated_by);

-- Project expenses history
CREATE INDEX IF NOT EXISTS idx_project_expenses_history_changed_by ON project_expenses_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_project_expenses_history_organization_id ON project_expenses_history(organization_id);

-- Project legal documents
CREATE INDEX IF NOT EXISTS idx_project_legal_documents_organization_id ON project_legal_documents(organization_id);

-- Project level1 stage status
CREATE INDEX IF NOT EXISTS idx_project_level1_stage_status_organization_id ON project_level1_stage_status(organization_id);

-- Project members
CREATE INDEX IF NOT EXISTS idx_project_members_organization_id ON project_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- Project roadmap stages
CREATE INDEX IF NOT EXISTS idx_project_roadmap_stages_organization_id ON project_roadmap_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_roadmap_stages_template_stage_id ON project_roadmap_stages(template_stage_id);

-- Project roadmap templates
CREATE INDEX IF NOT EXISTS idx_project_roadmap_templates_organization_id ON project_roadmap_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_roadmap_templates_template_id ON project_roadmap_templates(template_id);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_roadmap_template_id ON projects(roadmap_template_id);

-- Roadmap template stages
CREATE INDEX IF NOT EXISTS idx_roadmap_template_stages_organization_id ON roadmap_template_stages(organization_id);

-- Roadmap template tasks
CREATE INDEX IF NOT EXISTS idx_roadmap_template_tasks_organization_id ON roadmap_template_tasks(organization_id);

-- Roadmap templates
CREATE INDEX IF NOT EXISTS idx_roadmap_templates_organization_id ON roadmap_templates(organization_id);

-- Service calculator items
CREATE INDEX IF NOT EXISTS idx_service_calculator_items_organization_id ON service_calculator_items(organization_id);

-- Services
CREATE INDEX IF NOT EXISTS idx_services_organization_id ON services(organization_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_team_lead_id ON users(team_lead_id);

-- Wazzup channels
CREATE INDEX IF NOT EXISTS idx_wazzup_channels_organization_id ON wazzup_channels(organization_id);

-- Webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_organization_id ON webhook_logs(organization_id);

-- WhatsApp messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);

-- WhatsApp templates
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_created_by ON whatsapp_templates(created_by);