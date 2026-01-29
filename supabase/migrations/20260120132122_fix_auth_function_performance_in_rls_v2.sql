/*
  # Fix Auth Function Performance in RLS Policies

  1. Performance Improvements
    - Wraps auth.uid() calls in SELECT subqueries
    - Prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale

  2. Tables Affected
    - users: Updates profile view/update policies
    - contract_templates: Updates author policies (uses author_id)
    - notifications: Updates user notification policies
    - organizations: Updates owner update policy

  3. Changes Made
    - auth.uid() → (select auth.uid())
    - get_current_user_id() → (select get_current_user_id())

  See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
*/

-- Users table policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = auth_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = auth_id)
  WITH CHECK ((select auth.uid()) = auth_id);

-- Contract templates policies (using author_id)
DROP POLICY IF EXISTS "Users can create templates" ON contract_templates;
CREATE POLICY "Users can create templates"
  ON contract_templates FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authors can update own templates" ON contract_templates;
CREATE POLICY "Authors can update own templates"
  ON contract_templates FOR UPDATE
  TO authenticated
  USING (author_id = (select get_current_user_id()))
  WITH CHECK (author_id = (select get_current_user_id()));

DROP POLICY IF EXISTS "Authors can delete own templates" ON contract_templates;
CREATE POLICY "Authors can delete own templates"
  ON contract_templates FOR DELETE
  TO authenticated
  USING (author_id = (select get_current_user_id()));

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select get_current_user_id()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select get_current_user_id()))
  WITH CHECK (user_id = (select get_current_user_id()));

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = (select get_current_user_id()));

-- Organizations policies
DROP POLICY IF EXISTS "Organization owners can update their organization" ON organizations;
CREATE POLICY "Organization owners can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (owner_id = (select get_current_user_id()))
  WITH CHECK (owner_id = (select get_current_user_id()));