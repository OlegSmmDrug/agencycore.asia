/*
  # Fix calculator_services RLS policies for public access
  
  1. Changes
    - Drop existing restrictive policies requiring authenticated users
    - Create new public access policies (consistent with other tables)
  
  2. Notes
    - This allows the application to work without Supabase Auth
    - Matches the public access pattern from other tables (clients, projects, etc.)
*/

-- Drop existing authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can view calculator services" ON calculator_services;
DROP POLICY IF EXISTS "Authenticated users can insert calculator services" ON calculator_services;
DROP POLICY IF EXISTS "Authenticated users can update calculator services" ON calculator_services;
DROP POLICY IF EXISTS "Authenticated users can delete calculator services" ON calculator_services;

-- Create public access policies
CREATE POLICY "Allow public select on calculator_services" 
  ON calculator_services 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert on calculator_services" 
  ON calculator_services 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update on calculator_services" 
  ON calculator_services 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow public delete on calculator_services" 
  ON calculator_services 
  FOR DELETE 
  USING (true);
