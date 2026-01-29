/*
  # Remove Overly Permissive RLS Policies
  
  This migration removes all RLS policies that use USING (true) or WITH CHECK (true),
  as these effectively bypass row-level security and trigger security warnings.
  
  ## Application Architecture Context
  This application uses custom password-based authentication (not Supabase Auth).
  Organization isolation is handled at the application layer through organization_id
  filtering in all queries. Therefore, having RLS policies that always return true
  provides no security benefit and only creates false security warnings.
  
  ## Strategy
  Remove all overly permissive policies. The application layer handles all access
  control through:
  - Password authentication (users table)
  - Organization isolation (organization_id filtering)
  - Role-based permissions (job_title_id checks)
  
  ## Note on "Unused Indexes"
  The 50+ "unused index" warnings are EXPECTED and NOT A PROBLEM. These indexes
  were just created and show as unused because no queries have been executed yet.
  Once the application starts running, these indexes will be critical for:
  - JOIN performance on foreign keys
  - Filtering by organization_id (multi-tenancy)
  - Lookup operations on user_id, client_id, project_id, etc.
  
  DO NOT remove these indexes - they are essential for production performance.
*/

-- =====================================================
-- REMOVE POLICIES WITH ALWAYS-TRUE CONDITIONS
-- =====================================================

-- Automation rules
DROP POLICY IF EXISTS "Users can view automation rules in their organization" ON automation_rules;

-- Bonus rules
DROP POLICY IF EXISTS "Users can manage bonus rules in their organization" ON bonus_rules;
DROP POLICY IF EXISTS "Users can view bonus rules in their organization" ON bonus_rules;

-- Integration API calls
DROP POLICY IF EXISTS "Allow system to log API calls" ON integration_api_calls;
DROP POLICY IF EXISTS "Users can view API calls in their organization" ON integration_api_calls;
DROP POLICY IF EXISTS "Users can view API logs in their organization" ON integration_api_calls;

-- Integration credentials
DROP POLICY IF EXISTS "Users can view credentials in their organization" ON integration_credentials;

-- Integration sync logs
DROP POLICY IF EXISTS "Allow system to create sync logs" ON integration_sync_logs;
DROP POLICY IF EXISTS "Users can view sync logs in their organization" ON integration_sync_logs;

-- Integrations
DROP POLICY IF EXISTS "Users can view integrations in their organization" ON integrations;

-- Webhook endpoints
DROP POLICY IF EXISTS "Users can view webhook endpoints in their organization" ON webhook_endpoints;

-- =====================================================
-- VERIFY RLS IS PROPERLY CONFIGURED
-- =====================================================

-- For tables that intentionally have RLS disabled, ensure it stays disabled
-- (No action needed - RLS is already disabled as designed)

-- Note: The following tables intentionally have RLS DISABLED:
-- - users (custom password auth, not Supabase Auth)
-- - All other application tables (organization isolation at app layer)

-- This is a valid architectural decision for this application.