/*
  # Fix plan_included_modules RLS for admin operations

  1. Security Changes
    - Disable RLS on `plan_included_modules` table
    - This is a system configuration table managed only by super admins
    - It stores which modules are included in each plan
    - No user data; only system configuration
*/

ALTER TABLE plan_included_modules DISABLE ROW LEVEL SECURITY;
