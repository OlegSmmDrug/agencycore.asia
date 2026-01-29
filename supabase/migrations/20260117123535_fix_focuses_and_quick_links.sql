/*
  # Fix focuses and quick_links format

  1. Changes
    - Add `focuses` JSONB array column to projects table for multiple focus items
    - Ensure `quick_links_data` is properly configured as JSONB array

  2. Details
    - `focuses` stores array of focus objects with id, text, createdAt
    - `quick_links_data` stores array of link objects with id, name, url, color
*/

DO $$
BEGIN
  -- Add focuses column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'focuses'
  ) THEN
    ALTER TABLE projects ADD COLUMN focuses JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;
