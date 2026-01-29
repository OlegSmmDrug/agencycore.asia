/*
  # Sync team_ids from project_members table

  1. Purpose
    - Synchronize existing project_members data into projects.team_ids column
    - Ensures "Мои проекты" filter works correctly
    - One-time data migration

  2. Changes
    - Update all projects to have correct team_ids based on project_members
    - Creates consistency between project_members table and team_ids column

  3. Security
    - Read-only migration, safe to run multiple times
*/

-- Sync team_ids for all projects based on project_members
UPDATE projects p
SET team_ids = COALESCE(
  (
    SELECT array_agg(pm.user_id)
    FROM project_members pm
    WHERE pm.project_id = p.id
  ),
  ARRAY[]::uuid[]
)
WHERE EXISTS (
  SELECT 1 FROM project_members pm WHERE pm.project_id = p.id
);