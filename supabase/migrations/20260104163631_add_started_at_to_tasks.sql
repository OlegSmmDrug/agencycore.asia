/*
  # Add started_at column to tasks table

  1. Changes
    - Add `started_at` column to `tasks` table for tracking task start time
    - This allows tasks to have a separate start time from their deadline
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN started_at timestamptz;
  END IF;
END $$;