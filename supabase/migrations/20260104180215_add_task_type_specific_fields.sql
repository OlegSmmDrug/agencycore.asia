/*
  # Add task type-specific fields

  1. New Columns on `tasks` table
    - `address` (text) - Physical address for shootings and meetings
    - `address_link` (text) - 2GIS or Google Maps link
    - `participants` (text[]) - Array of team member IDs
    - `external_participants` (text) - External people (for meetings/shootings)
    - `equipment` (text) - Equipment list for shootings
    - `scenario` (text) - Scenario/script for shootings
    - `call_link` (text) - Video call link for calls
    - `meeting_with` (text) - Who the meeting is with

  2. Purpose
    - Different task types (Task, Shooting, Meeting, Call) now have type-specific fields
    - Shooting: address, participants, equipment, scenario, calendar
    - Meeting: address, participants, meeting_with
    - Call: call_link, participants
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'address'
  ) THEN
    ALTER TABLE tasks ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'address_link'
  ) THEN
    ALTER TABLE tasks ADD COLUMN address_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'participants'
  ) THEN
    ALTER TABLE tasks ADD COLUMN participants text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'external_participants'
  ) THEN
    ALTER TABLE tasks ADD COLUMN external_participants text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'equipment'
  ) THEN
    ALTER TABLE tasks ADD COLUMN equipment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'scenario'
  ) THEN
    ALTER TABLE tasks ADD COLUMN scenario text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'call_link'
  ) THEN
    ALTER TABLE tasks ADD COLUMN call_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'meeting_with'
  ) THEN
    ALTER TABLE tasks ADD COLUMN meeting_with text;
  END IF;
END $$;
