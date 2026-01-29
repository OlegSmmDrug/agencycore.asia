/*
  # Update RLS Policies for Multi-Tenancy

  ## Overview
  This migration updates ALL RLS policies to enforce organization-level data isolation.
  Users can only access data from their own organization, except super admins who see everything.

  ## Strategy
  1. Drop existing policies that don't have organization checks
  2. Create new policies with organization_id filtering
  3. Super admins bypass all restrictions

  ## Tables Updated
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
  - And all other organization-specific tables
*/

-- Users table policies
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Allow public insert to users" ON users;
DROP POLICY IF EXISTS "Allow public update to users" ON users;
DROP POLICY IF EXISTS "Allow public delete from users" ON users;

CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert users in their organization"
  ON users FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update users in their organization"
  ON users FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  )
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Super admin can delete users"
  ON users FOR DELETE
  USING (is_super_admin());

-- Clients table policies
DROP POLICY IF EXISTS "Allow public read access to clients" ON clients;
DROP POLICY IF EXISTS "Allow public insert to clients" ON clients;
DROP POLICY IF EXISTS "Allow public update to clients" ON clients;
DROP POLICY IF EXISTS "Allow public delete from clients" ON clients;

CREATE POLICY "Users can view clients in their organization"
  ON clients FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert clients in their organization"
  ON clients FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update clients in their organization"
  ON clients FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  )
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete clients in their organization"
  ON clients FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Projects table policies
DROP POLICY IF EXISTS "Allow public read access to projects" ON projects;
DROP POLICY IF EXISTS "Allow public insert to projects" ON projects;
DROP POLICY IF EXISTS "Allow public update to projects" ON projects;
DROP POLICY IF EXISTS "Allow public delete from projects" ON projects;

CREATE POLICY "Users can view projects in their organization"
  ON projects FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert projects in their organization"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update projects in their organization"
  ON projects FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  )
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete projects in their organization"
  ON projects FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Tasks table policies
DROP POLICY IF EXISTS "Allow public read access to tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public insert to tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public update to tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public delete from tasks" ON tasks;

CREATE POLICY "Users can view tasks in their organization"
  ON tasks FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert tasks in their organization"
  ON tasks FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update tasks in their organization"
  ON tasks FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  )
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete tasks in their organization"
  ON tasks FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Transactions table policies
DROP POLICY IF EXISTS "Allow public read access to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public insert to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public update to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public delete from transactions" ON transactions;

CREATE POLICY "Users can view transactions in their organization"
  ON transactions FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert transactions in their organization"
  ON transactions FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update transactions in their organization"
  ON transactions FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  )
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete transactions in their organization"
  ON transactions FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Documents table policies
DROP POLICY IF EXISTS "Allow public read access to documents" ON documents;
DROP POLICY IF EXISTS "Allow public insert to documents" ON documents;
DROP POLICY IF EXISTS "Allow public update to documents" ON documents;
DROP POLICY IF EXISTS "Allow public delete from documents" ON documents;

CREATE POLICY "Users can view documents in their organization"
  ON documents FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert documents in their organization"
  ON documents FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update documents in their organization"
  ON documents FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  )
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete documents in their organization"
  ON documents FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- WhatsApp messages table policies
DROP POLICY IF EXISTS "Allow public read access to whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Allow public insert to whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Allow public update to whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Allow public delete from whatsapp_messages" ON whatsapp_messages;

CREATE POLICY "Users can view whatsapp messages in their organization"
  ON whatsapp_messages FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert whatsapp messages in their organization"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update whatsapp messages in their organization"
  ON whatsapp_messages FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete whatsapp messages in their organization"
  ON whatsapp_messages FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- WhatsApp templates table policies
DROP POLICY IF EXISTS "Allow public read access to whatsapp_templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Allow public insert to whatsapp_templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Allow public update to whatsapp_templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Allow public delete from whatsapp_templates" ON whatsapp_templates;

CREATE POLICY "Users can view whatsapp templates in their organization"
  ON whatsapp_templates FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert whatsapp templates in their organization"
  ON whatsapp_templates FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update whatsapp templates in their organization"
  ON whatsapp_templates FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete whatsapp templates in their organization"
  ON whatsapp_templates FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- WhatsApp chats table policies
DROP POLICY IF EXISTS "Allow public read access to whatsapp_chats" ON whatsapp_chats;
DROP POLICY IF EXISTS "Allow public insert to whatsapp_chats" ON whatsapp_chats;
DROP POLICY IF EXISTS "Allow public update to whatsapp_chats" ON whatsapp_chats;
DROP POLICY IF EXISTS "Allow public delete from whatsapp_chats" ON whatsapp_chats;

CREATE POLICY "Users can view whatsapp chats in their organization"
  ON whatsapp_chats FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can insert whatsapp chats in their organization"
  ON whatsapp_chats FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can update whatsapp chats in their organization"
  ON whatsapp_chats FOR UPDATE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Users can delete whatsapp chats in their organization"
  ON whatsapp_chats FOR DELETE
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Create indexes for performance on organization_id
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_organization ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_organization ON whatsapp_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_organization ON whatsapp_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_organization ON whatsapp_chats(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_organization ON notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_organization ON payroll_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_salary_schemes_organization ON salary_schemes(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_organization ON contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_instances_organization ON contract_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_organization ON project_expenses(organization_id);
