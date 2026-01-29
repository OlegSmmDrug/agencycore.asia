/*
  # Fix Integration Credentials encrypted_value Column
  
  1. Changes
    - Make `encrypted_value` column nullable (it's being replaced by `credential_value`)
    - Set default value for `credential_value` if it's NULL
    - Ensure smooth transition between old and new schema
  
  2. Notes
    - The new schema uses `credential_value` (text) instead of `encrypted_value` (bytea)
    - This migration ensures backward compatibility during transition
*/

-- Make encrypted_value nullable (it's being deprecated)
ALTER TABLE integration_credentials 
ALTER COLUMN encrypted_value DROP NOT NULL;

-- Set default empty bytea for existing rows to satisfy constraint temporarily
UPDATE integration_credentials 
SET encrypted_value = ''::bytea 
WHERE encrypted_value IS NULL;
