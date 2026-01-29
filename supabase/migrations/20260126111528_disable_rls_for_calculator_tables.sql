/*
  # Disable RLS for Calculator Tables
  
  This migration disables Row Level Security (RLS) for calculator-related tables
  to support the simple authentication system without Supabase Auth.
  
  ## Changes
  - Disable RLS for `calculator_categories` table
  - Disable RLS for `calculator_services` table
  
  ## Reason
  The application uses simple password-based authentication stored in the `users` table,
  not Supabase Auth. The existing RLS policies use `get_current_user_organization_id()` 
  which requires Supabase Auth and always returns NULL with simple auth.
  
  Organization isolation is maintained at the application layer via the 
  `getCurrentOrganizationId()` function which reads from localStorage.
*/

-- Disable RLS for calculator categories
ALTER TABLE calculator_categories DISABLE ROW LEVEL SECURITY;

-- Disable RLS for calculator services  
ALTER TABLE calculator_services DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies for calculator_categories
DROP POLICY IF EXISTS "Users can view categories in their organization" ON calculator_categories;
DROP POLICY IF EXISTS "Users can insert categories in their organization" ON calculator_categories;
DROP POLICY IF EXISTS "Users can update categories in their organization" ON calculator_categories;
DROP POLICY IF EXISTS "Users can delete categories in their organization" ON calculator_categories;

-- Drop existing RLS policies for calculator_services
DROP POLICY IF EXISTS "Users can view services in their organization" ON calculator_services;
DROP POLICY IF EXISTS "Users can insert services in their organization" ON calculator_services;
DROP POLICY IF EXISTS "Users can update services in their organization" ON calculator_services;
DROP POLICY IF EXISTS "Users can delete services in their organization" ON calculator_services;