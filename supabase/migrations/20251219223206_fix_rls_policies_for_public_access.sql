/*
  # Fix RLS policies for public access
  
  1. Changes
    - Drop existing restrictive policies on clients table
    - Create new policies that allow public access (for demo/development)
    - Same changes for projects, tasks, users, transactions, documents tables
  
  2. Notes
    - This enables the application to work without Supabase Auth
    - For production, these should be changed to use proper authentication
*/

-- Drop existing policies on clients
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;

-- Create public access policies for clients
CREATE POLICY "Allow public select on clients" ON clients FOR SELECT USING (true);
CREATE POLICY "Allow public insert on clients" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on clients" ON clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on clients" ON clients FOR DELETE USING (true);

-- Drop existing policies on projects
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can delete projects" ON projects;

-- Create public access policies for projects
CREATE POLICY "Allow public select on projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert on projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on projects" ON projects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on projects" ON projects FOR DELETE USING (true);

-- Drop existing policies on tasks
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;

-- Create public access policies for tasks
CREATE POLICY "Allow public select on tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tasks" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tasks" ON tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on tasks" ON tasks FOR DELETE USING (true);

-- Drop existing policies on users
DROP POLICY IF EXISTS "Users can view users" ON users;
DROP POLICY IF EXISTS "Users can insert users" ON users;
DROP POLICY IF EXISTS "Users can update users" ON users;
DROP POLICY IF EXISTS "Users can delete users" ON users;

-- Create public access policies for users
CREATE POLICY "Allow public select on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on users" ON users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on users" ON users FOR DELETE USING (true);

-- Drop existing policies on transactions
DROP POLICY IF EXISTS "Users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON transactions;

-- Create public access policies for transactions
CREATE POLICY "Allow public select on transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on transactions" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on transactions" ON transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on transactions" ON transactions FOR DELETE USING (true);

-- Drop existing policies on documents
DROP POLICY IF EXISTS "Users can view documents" ON documents;
DROP POLICY IF EXISTS "Users can insert documents" ON documents;
DROP POLICY IF EXISTS "Users can update documents" ON documents;
DROP POLICY IF EXISTS "Users can delete documents" ON documents;

-- Create public access policies for documents
CREATE POLICY "Allow public select on documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert on documents" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on documents" ON documents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on documents" ON documents FOR DELETE USING (true);