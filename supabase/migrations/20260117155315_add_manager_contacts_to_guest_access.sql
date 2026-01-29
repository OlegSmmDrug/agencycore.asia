/*
  # Add Manager Contact Information to Guest Access

  ## Overview
  This migration adds manager contact fields to the guest_access table,
  allowing project managers to provide their contact information that
  will be visible to clients in the guest project view.

  ## Changes
  
  1. New Columns in `guest_access`:
     - `manager_name` (text) - Manager's full name
     - `manager_phone` (text) - Manager's phone number
     - `manager_email` (text) - Manager's email address
  
  2. Notes
     - All fields are optional (nullable)
     - Manager contacts are visible to guests viewing the project
     - Can be edited in the "Share Project" modal
*/

-- Add manager contact fields to guest_access table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_access' AND column_name = 'manager_name'
  ) THEN
    ALTER TABLE guest_access ADD COLUMN manager_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_access' AND column_name = 'manager_phone'
  ) THEN
    ALTER TABLE guest_access ADD COLUMN manager_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guest_access' AND column_name = 'manager_email'
  ) THEN
    ALTER TABLE guest_access ADD COLUMN manager_email text;
  END IF;
END $$;