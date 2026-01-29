/*
  # Add client_id field to notes table

  1. Changes
    - Add `client_id` field to notes table for client-specific notes
    - Notes can now be associated with either a project or a client
    
  2. Security
    - Uses IF NOT EXISTS to prevent errors on rerun
    - Existing RLS policies remain unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE notes ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;
