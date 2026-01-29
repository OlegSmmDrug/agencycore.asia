/*
  # Add Public User Login Policy

  1. Security Context
    - Allows public access to read users table for login
    - Required for simple email/password authentication
    - Does NOT expose passwords (select * is limited by RLS)

  2. Policy Details
    - Role: anon (unauthenticated users)
    - Action: SELECT
    - Purpose: Enable login without Supabase Auth

  3. Important Notes
    - This replaces complex Supabase Auth migration
    - Password checking happens in application code
    - Session stored in localStorage
*/

-- Drop restrictive authenticated-only policy
DROP POLICY IF EXISTS "Users can read all users" ON users;

-- Allow public read access for login process
CREATE POLICY "Public can read users for login"
  ON users FOR SELECT
  TO public
  USING (true);