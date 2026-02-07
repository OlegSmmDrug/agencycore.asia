/*
  # Add scope_of_work to projects

  1. Modified Tables
    - `projects`
      - `scope_of_work` (jsonb) - Array of work items with id, label, quantity for displaying project scope breakdown

  2. Notes
    - JSONB column with default empty array
    - No data migration needed - existing projects will show empty scope
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'scope_of_work'
  ) THEN
    ALTER TABLE projects ADD COLUMN scope_of_work jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
