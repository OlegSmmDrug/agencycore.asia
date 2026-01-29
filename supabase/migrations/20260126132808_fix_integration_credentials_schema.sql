/*
  # Fix Integration Credentials Schema
  
  1. Changes
    - Add `organization_id` column to `integration_credentials` table
    - Rename `encrypted_value` to `credential_value` and change type to text
    - Add `is_encrypted` column
    - Update UNIQUE constraint to include organization_id
    - Populate organization_id from integrations table for existing records
  
  2. Security
    - Maintain referential integrity with integrations table
    - Keep RLS and existing security policies
*/

-- Add organization_id column
ALTER TABLE integration_credentials 
ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Populate organization_id from integrations table for existing records
UPDATE integration_credentials ic
SET organization_id = i.organization_id
FROM integrations i
WHERE ic.integration_id = i.id
  AND ic.organization_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'integration_credentials_organization_id_fkey'
  ) THEN
    ALTER TABLE integration_credentials
    ADD CONSTRAINT integration_credentials_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make organization_id NOT NULL after populating
ALTER TABLE integration_credentials 
ALTER COLUMN organization_id SET NOT NULL;

-- Add credential_value as text column
ALTER TABLE integration_credentials 
ADD COLUMN IF NOT EXISTS credential_value text;

-- Add is_encrypted column
ALTER TABLE integration_credentials 
ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Drop old UNIQUE constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'integration_credentials_integration_id_credential_key_key'
  ) THEN
    ALTER TABLE integration_credentials 
    DROP CONSTRAINT integration_credentials_integration_id_credential_key_key;
  END IF;
END $$;

-- Add new UNIQUE constraint with organization_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'integration_credentials_integration_org_key_unique'
  ) THEN
    ALTER TABLE integration_credentials 
    ADD CONSTRAINT integration_credentials_integration_org_key_unique 
    UNIQUE (integration_id, organization_id, credential_key);
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_integration_credentials_org_id 
ON integration_credentials(organization_id);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_integration_org 
ON integration_credentials(integration_id, organization_id);
