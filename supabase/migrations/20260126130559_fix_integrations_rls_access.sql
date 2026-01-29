/*
  # Fix Integrations Table Access

  1. Changes
    - Disable RLS on integrations table
    - Disable RLS on integration_credentials table
  
  2. Reason
    - System uses simple authentication without Supabase Auth
    - RLS was enabled without policies, blocking all access
    - Organization isolation is handled in application layer via getCurrentOrganizationId()
*/

-- Disable RLS for integrations
ALTER TABLE integrations DISABLE ROW LEVEL SECURITY;

-- Disable RLS for integration_credentials  
ALTER TABLE integration_credentials DISABLE ROW LEVEL SECURITY;
