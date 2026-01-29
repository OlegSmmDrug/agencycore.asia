/*
  # Add automatic organization_id to documents table

  1. Changes
    - Add DEFAULT value for organization_id column to automatically set it on insert
    - Update existing documents with NULL organization_id to legacy organization
  
  2. Security
    - No changes to RLS policies (already working correctly)
    - Documents will be automatically scoped to user's organization
*/

-- Add DEFAULT value to automatically set organization_id on insert
ALTER TABLE documents 
ALTER COLUMN organization_id 
SET DEFAULT get_current_user_organization_id();

-- Update existing documents with NULL organization_id
-- Assign them to the first available organization (legacy organization)
UPDATE documents
SET organization_id = (
  SELECT id FROM organizations ORDER BY created_at LIMIT 1
)
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL to enforce organization isolation
ALTER TABLE documents 
ALTER COLUMN organization_id SET NOT NULL;
