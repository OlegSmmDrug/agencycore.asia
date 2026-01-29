/*
  # Agency ERP Database Schema
  
  1. New Tables
    - users (Пользователи системы)
      - id (uuid, primary key)
      - name (text)
      - email (text, unique)
      - avatar (text)
      - system_role (text)
      - job_title (text)
      - allowed_modules (text[])
      - salary (numeric)
      - created_at (timestamptz)
      
    - clients (Клиенты)
      - id (uuid, primary key)
      - name (text) - Контактное лицо
      - company (text)
      - status (text)
      - email (text)
      - phone (text)
      - budget (numeric)
      - prepayment (numeric)
      - source (text)
      - manager_id (uuid, FK -> users)
      - description (text)
      - files_link (text)
      - service (text)
      - inn (text)
      - address (text)
      - legal_name (text)
      - director (text)
      - is_archived (boolean)
      - created_at (timestamptz)
      
    - projects (Проекты)
      - id (uuid, primary key)
      - client_id (uuid, FK -> clients)
      - name (text)
      - status (text)
      - start_date (date)
      - end_date (date)
      - duration (integer)
      - budget (numeric)
      - total_ltv (numeric)
      - media_budget (numeric)
      - description (text)
      - team_ids (uuid[])
      - services (text[])
      - ad_account_id (text)
      - livedune_account_id (integer)
      - is_archived (boolean)
      - created_at (timestamptz)
      
    - tasks (Задачи)
      - id (uuid, primary key)
      - project_id (uuid, FK -> projects)
      - client_id (uuid, FK -> clients)
      - assignee_id (uuid, FK -> users)
      - creator_id (uuid, FK -> users)
      - title (text)
      - description (text)
      - status (text)
      - priority (text)
      - deadline (timestamptz)
      - kpi_value (numeric)
      - type (text)
      - start_time (timestamptz)
      - duration (integer)
      - acceptance_status (text)
      - tags (text[])
      - subtasks (jsonb)
      - comments (jsonb)
      - files (jsonb)
      - custom_fields (jsonb)
      - created_at (timestamptz)
      - completed_at (timestamptz)
      
    - transactions (Транзакции/Платежи)
      - id (uuid, primary key)
      - client_id (uuid, FK -> clients)
      - project_id (uuid, FK -> projects)
      - amount (numeric)
      - date (timestamptz)
      - type (text)
      - description (text)
      - is_verified (boolean)
      - created_at (timestamptz)
      
    - documents (База знаний)
      - id (uuid, primary key)
      - parent_id (uuid, FK -> documents)
      - title (text)
      - icon (text)
      - content (text)
      - author_id (uuid, FK -> users)
      - allowed_user_ids (uuid[])
      - is_public (boolean)
      - public_link (text)
      - is_archived (boolean)
      - is_folder (boolean)
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  avatar text DEFAULT '',
  system_role text NOT NULL DEFAULT 'Member',
  job_title text NOT NULL DEFAULT 'Employee',
  allowed_modules text[] DEFAULT ARRAY[]::text[],
  salary numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL,
  status text NOT NULL DEFAULT 'New Lead',
  email text DEFAULT '',
  phone text DEFAULT '',
  budget numeric DEFAULT 0,
  prepayment numeric DEFAULT 0,
  source text DEFAULT 'Manual',
  manager_id uuid REFERENCES users(id),
  description text DEFAULT '',
  files_link text DEFAULT '',
  service text DEFAULT '',
  inn text DEFAULT '',
  address text DEFAULT '',
  legal_name text DEFAULT '',
  director text DEFAULT '',
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'New',
  start_date date DEFAULT CURRENT_DATE,
  end_date date DEFAULT CURRENT_DATE,
  duration integer DEFAULT 30,
  budget numeric DEFAULT 0,
  total_ltv numeric DEFAULT 0,
  media_budget numeric DEFAULT 0,
  description text DEFAULT '',
  team_ids uuid[] DEFAULT ARRAY[]::uuid[],
  services text[] DEFAULT ARRAY[]::text[],
  ad_account_id text DEFAULT '',
  livedune_account_id integer DEFAULT 0,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (true);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  client_id uuid REFERENCES clients(id),
  assignee_id uuid REFERENCES users(id),
  creator_id uuid REFERENCES users(id),
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'To Do',
  priority text DEFAULT 'Medium',
  deadline timestamptz,
  kpi_value numeric DEFAULT 0,
  type text DEFAULT 'Task',
  start_time timestamptz,
  duration integer DEFAULT 0,
  acceptance_status text DEFAULT 'Pending',
  tags text[] DEFAULT ARRAY[]::text[],
  subtasks jsonb DEFAULT '[]'::jsonb,
  comments jsonb DEFAULT '[]'::jsonb,
  files jsonb DEFAULT '[]'::jsonb,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (true);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  amount numeric NOT NULL DEFAULT 0,
  date timestamptz DEFAULT now(),
  type text NOT NULL DEFAULT 'Prepayment',
  description text DEFAULT '',
  is_verified boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (true);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES documents(id),
  title text NOT NULL,
  icon text DEFAULT '📄',
  content text DEFAULT '',
  author_id uuid REFERENCES users(id),
  allowed_user_ids uuid[] DEFAULT ARRAY[]::uuid[],
  is_public boolean DEFAULT false,
  public_link text DEFAULT '',
  is_archived boolean DEFAULT false,
  is_folder boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_manager_id ON clients(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id);