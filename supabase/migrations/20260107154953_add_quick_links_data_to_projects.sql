/*
  # Add Quick Links Data to Projects

  1. Changes
    - Add `quick_links_data` JSONB column to `projects` table
    - This stores structured quick links (figma, drive, kp, contentPlan)
    - New format replaces the flexible array with fixed structure

  2. Notes
    - JSONB type allows flexible storage while maintaining query capabilities
    - Default value is empty object
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'quick_links_data'
  ) THEN
    ALTER TABLE projects ADD COLUMN quick_links_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
