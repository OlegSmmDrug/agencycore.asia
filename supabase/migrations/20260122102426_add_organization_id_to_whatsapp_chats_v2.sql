/*
  # Add organization_id to whatsapp_chats

  1. Changes
    - Add `organization_id` column to `whatsapp_chats` table
    - Set organization_id for all existing records
    - Add foreign key constraint
    - Add index for performance

  2. Security
    - Organization filtering applied via existing RLS policies
*/

-- Add organization_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE whatsapp_chats ADD COLUMN organization_id uuid;
  END IF;
END $$;

-- Set organization_id for all existing records using first available organization
UPDATE whatsapp_chats
SET organization_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
WHERE organization_id IS NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'whatsapp_chats_organization_id_fkey'
      AND table_name = 'whatsapp_chats'
  ) THEN
    ALTER TABLE whatsapp_chats 
    ADD CONSTRAINT whatsapp_chats_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make organization_id NOT NULL
ALTER TABLE whatsapp_chats ALTER COLUMN organization_id SET NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_organization_id ON whatsapp_chats(organization_id);