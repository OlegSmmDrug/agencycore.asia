/*
  # Add Legacy User Migration Update Policy

  1. Security Context
    - Allows linking Supabase Auth ID to legacy user profile
    - ONLY for users with auth_id IS NULL (not yet migrated)
    - Required to complete automatic migration process

  2. Policy Details
    - Role: anon, authenticated (during migration process)
    - Action: UPDATE only
    - Conditions: 
      - auth_id IS NULL (can only update unmigrated users)
      - Prevents updating already migrated users
    - Use case: authService.signIn() auth_id linking

  3. Security Measures
    - Cannot update migrated users (auth_id NOT NULL)
    - One-time update per user (after migration, auth_id is set)
    - Prevents hijacking migrated accounts
*/

-- Allow anonymous users to link auth_id during migration
CREATE POLICY "Allow legacy user auth_id linking"
  ON users FOR UPDATE
  TO anon, authenticated
  USING (auth_id IS NULL)
  WITH CHECK (auth_id IS NOT NULL);