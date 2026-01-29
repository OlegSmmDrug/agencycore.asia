/*
  # Update RLS Policies for auth.uid()

  ## Overview
  Updates RLS policies to work correctly with Supabase Auth (auth.uid()).
  The helper functions already support auth.uid(), this migration adds
  additional policies for better user experience.

  ## Changes
  1. Add policy for users to read their own profile via auth.uid()
  2. Add policy for authenticated users to update their own profile
  3. Update organization access policies
  4. Ensure guest access still works with tokens

  ## Security
  - Users can only see data from their organization
  - Users can read and update their own profile
  - Super admins have full access
  - Guest users have limited access via guest_access tokens
*/

-- Add policy for users to read their own profile via auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (
    auth_id = auth.uid()
    OR id = auth.uid()
    OR is_super_admin()
  );

-- Add policy for users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (
    auth_id = auth.uid()
    OR id = auth.uid()
    OR is_super_admin()
  )
  WITH CHECK (
    auth_id = auth.uid()
    OR id = auth.uid()
    OR is_super_admin()
  );

-- Update organization policies to ensure auth users can see their own org
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Policy for users to update their own organization (if they're the owner)
DROP POLICY IF EXISTS "Organization owners can update their organization" ON organizations;
CREATE POLICY "Organization owners can update their organization"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.id = organizations.owner_id
    )
    OR is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.id = organizations.owner_id
    )
    OR is_super_admin()
  );

-- Policy for organization subscriptions
DROP POLICY IF EXISTS "Users can view their organization subscription" ON organization_subscriptions;
CREATE POLICY "Users can view their organization subscription"
  ON organization_subscriptions FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Policy for usage metrics
DROP POLICY IF EXISTS "Users can view their organization usage" ON usage_metrics;
CREATE POLICY "Users can view their organization usage"
  ON usage_metrics FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Ensure authenticated users can call RPC functions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create helper function to get current user id (works with both auth.uid and legacy)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- First try to find user by auth_id
  SELECT id INTO user_id
  FROM users
  WHERE auth_id = auth.uid();
  
  IF user_id IS NOT NULL THEN
    RETURN user_id;
  END IF;

  -- Fallback to legacy (id = auth.uid())
  RETURN auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated, anon;

-- Update activity_log policies to use new function
DROP POLICY IF EXISTS "Users can view activity in their organization" ON activity_log;
CREATE POLICY "Users can view activity in their organization"
  ON activity_log FOR SELECT
  USING (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Users can insert activity in their organization" ON activity_log;
CREATE POLICY "Users can insert activity in their organization"
  ON activity_log FOR INSERT
  WITH CHECK (
    organization_id = get_current_user_organization_id()
    OR is_super_admin()
  );

-- Update notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    user_id = get_current_user_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (
    user_id = get_current_user_id()
    OR is_super_admin()
  )
  WITH CHECK (
    user_id = get_current_user_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (
    user_id = get_current_user_id()
    OR is_super_admin()
  );
