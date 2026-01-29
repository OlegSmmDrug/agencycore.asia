/*
  # Add image_url field to projects table

  1. Changes
    - Add `image_url` column to `projects` table
      - Type: text (URL string)
      - Optional field
      - Default: null

  2. Notes
    - No existing data will be affected
    - Allows storing project cover images
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE projects ADD COLUMN image_url text;
  END IF;
END $$;
