/*
  # Fix activity log RLS and add status tracking
  
  1. Changes
    - Drop existing activity_log policies for authenticated users
    - Create new public access policies for activity_log table
    - Add status_changed_at column to clients table for tracking when status changed
  
  2. Security
    - Enables public access to activity_log (consistent with other tables)
    - For production, this should use proper authentication
*/

-- Drop existing policies on activity_log
DROP POLICY IF EXISTS "Authenticated users can read activity log" ON activity_log;
DROP POLICY IF EXISTS "Authenticated users can create activity log entries" ON activity_log;

-- Create public access policies for activity_log
CREATE POLICY "Allow public select on activity_log" ON activity_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert on activity_log" ON activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on activity_log" ON activity_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on activity_log" ON activity_log FOR DELETE USING (true);

-- Add status_changed_at column to clients for tracking when status was last changed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'status_changed_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN status_changed_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create index for better performance on activity_log queries
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);