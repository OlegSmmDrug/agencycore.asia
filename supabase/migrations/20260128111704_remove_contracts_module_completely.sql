/*
  # Remove Contracts Module Completely

  1. Tables Removed
    - `contract_templates` - Contract template definitions with field parsing
    - `contract_instances` - Generated contract documents for clients
    - `executor_company_info` - Company legal information for contracts
  
  2. Storage Buckets Removed
    - `client-contracts` - Storage for generated contract files
    - `contract-templates` - Storage for contract template files
  
  3. Related Functions Removed
    - `increment_template_usage()` - Function that tracked template usage
  
  4. Notes
    - All contract data will be permanently deleted
    - This operation cannot be undone
    - Foreign key references are dropped first to avoid conflicts
*/

-- Drop storage objects first, then policies, then buckets
DELETE FROM storage.objects WHERE bucket_id = 'contract-templates';
DELETE FROM storage.objects WHERE bucket_id = 'client-contracts';

DROP POLICY IF EXISTS "Public can view contract templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload contract templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own contract templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own contract templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own client contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload client contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own client contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own client contracts" ON storage.objects;

DELETE FROM storage.buckets WHERE id = 'contract-templates';
DELETE FROM storage.buckets WHERE id = 'client-contracts';

-- Drop function if exists
DROP FUNCTION IF EXISTS increment_template_usage(uuid);

-- Drop tables (drop dependent tables first)
DROP TABLE IF EXISTS contract_instances CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;
DROP TABLE IF EXISTS executor_company_info CASCADE;