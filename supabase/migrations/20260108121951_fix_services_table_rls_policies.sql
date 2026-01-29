/*
  # Fix RLS policies for services table to allow public access

  ## Summary
  This migration updates the RLS policies for the services table to allow public access,
  matching the access pattern used by other tables in the system. This is necessary because
  the application uses custom authentication instead of Supabase Auth.

  ## Changes
  - Drop existing restrictive policies on services table that require authentication
  - Create new policies that allow public access for all operations (SELECT, INSERT, UPDATE, DELETE)

  ## Security
  - Changes policies from authenticated-only to public access
  - Maintains RLS enabled on the table
  - Consistent with other tables in the system (clients, projects, tasks, etc.)

  ## Notes
  - This enables the application to work without Supabase Auth
  - For production deployment, consider implementing proper authentication policies
*/

-- Drop existing policies on services
DROP POLICY IF EXISTS "Authenticated users can read all services" ON services;
DROP POLICY IF EXISTS "Authenticated users can insert services" ON services;
DROP POLICY IF EXISTS "Authenticated users can update services" ON services;
DROP POLICY IF EXISTS "Authenticated users can delete services" ON services;

-- Create public access policies for services
CREATE POLICY "Allow public select on services" 
  ON services 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert on services" 
  ON services 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update on services" 
  ON services 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow public delete on services" 
  ON services 
  FOR DELETE 
  USING (true);