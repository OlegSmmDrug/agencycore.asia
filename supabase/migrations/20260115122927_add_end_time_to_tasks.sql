/*
  # Add end time field to tasks

  1. Changes
    - Add `end_time` column to `tasks` table
      - Stores the end time (HH:MM) for task deadlines
      - Allows users to specify not just the deadline date, but also the time by which the task should be completed
      - Optional field (nullable)
      - Text format for storing time strings like "18:00"

  2. Notes
    - This complements the existing `deadline` (date) and `start_time` fields
    - Useful for time-sensitive tasks and better scheduling
    - No data migration needed as field is optional
*/

-- Add end_time column to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE tasks ADD COLUMN end_time text;
  END IF;
END $$;