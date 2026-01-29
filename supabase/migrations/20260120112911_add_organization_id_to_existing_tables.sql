/*
  # Add organization_id to All Existing Tables

  ## Overview
  This migration adds organization_id column to all existing tables to support multi-tenancy.
  The column is initially nullable to allow for data migration in the next step.

  ## Tables Modified
  - users
  - clients  
  - projects
  - tasks
  - transactions
  - documents
  - whatsapp_messages
  - whatsapp_templates
  - whatsapp_chats
  - notes
  - services
  - payroll_records
  - salary_schemes
  - contract_templates
  - contract_instances
  - roadmap_templates
  - roadmap_template_stages
  - roadmap_template_tasks
  - project_roadmap_stages
  - job_titles
  - guest_users
  - guest_access
  - guest_project_access
  - service_calculator_items
  - kpi_presets
  - project_expenses
  - project_legal_documents
  - activity_log
  - notifications
  - wazzup_channels
  - webhook_logs

  ## Strategy
  1. Add organization_id as NULLABLE first
  2. Next migration will populate data and make it NOT NULL
  3. Indexes will be added after data migration
*/

-- Add organization_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to whatsapp_messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to whatsapp_templates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_templates' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE whatsapp_templates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to whatsapp_chats table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE whatsapp_chats ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to notes table  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE notes ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to services table (nullable for global services)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE services ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to payroll_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to salary_schemes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salary_schemes' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE salary_schemes ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to contract_templates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_templates' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE contract_templates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to contract_instances table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_instances' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE contract_instances ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to roadmap_templates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_templates' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE roadmap_templates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add is_global flag to roadmap_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_templates' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE roadmap_templates ADD COLUMN is_global boolean DEFAULT false;
  END IF;
END $$;

-- Add organization_id to roadmap_template_stages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_stages' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE roadmap_template_stages ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to roadmap_template_tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_tasks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE roadmap_template_tasks ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_roadmap_stages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_stages' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_roadmap_stages ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to job_titles table (nullable for global job titles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_titles' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE job_titles ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to guest_users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE guest_users ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to guest_access table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_access' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE guest_access ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to guest_project_access table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_project_access' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE guest_project_access ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to service_calculator_items table (nullable for global items)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_calculator_items' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE service_calculator_items ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to kpi_presets table (nullable for global presets)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_presets' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE kpi_presets ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_legal_documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_legal_documents' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_legal_documents ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to activity_log table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_log' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE activity_log ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to wazzup_channels table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wazzup_channels' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE wazzup_channels ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to webhook_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_logs' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE webhook_logs ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to calculator_services table (nullable for global services)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calculator_services' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE calculator_services ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to company_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to executor_company_info table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executor_company_info' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE executor_company_info ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_members table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_members ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_roadmap_templates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_roadmap_templates' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_roadmap_templates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_level1_stage_status table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_level1_stage_status' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_level1_stage_status ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add organization_id to project_expenses_history table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses_history' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_expenses_history ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
