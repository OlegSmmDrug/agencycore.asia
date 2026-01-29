/*
  # Add Legacy User Migration Policy

  1. Security Context
    - Allows anonymous users to find legacy users for migration
    - ONLY for users with auth_id IS NULL (not yet migrated)
    - Required for automatic migration from legacy auth to Supabase Auth

  2. Policy Details
    - Role: anon (unauthenticated users)
    - Action: SELECT only
    - Conditions: auth_id IS NULL (legacy users only)
    - Use case: authService.signIn() legacy user lookup

  3. Security Measures
    - Cannot read migrated users (auth_id NOT NULL)
    - Cannot modify any data
    - Only enables one-time migration process
*/

-- Allow anonymous users to find legacy users for migration
CREATE POLICY "Allow legacy user migration lookup"
  ON users FOR SELECT
  TO anon
  USING (auth_id IS NULL);