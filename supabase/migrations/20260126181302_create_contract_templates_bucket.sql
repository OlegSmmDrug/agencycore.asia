/*
  # Create contract-templates storage bucket

  1. Storage
    - Create public bucket named `contract-templates` for storing contract template files
    - Set file size limit to 10MB (sufficient for DOCX template files)
    - Public access allows templates to be downloaded and used for generation

  2. Security
    - Public bucket for template files (need to be accessible for contract generation)
    - Storage policies to control upload/update/delete operations
    - No RLS restrictions as RLS is disabled for simple auth
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('contract-templates', 'contract-templates', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Allow all users to upload templates (RLS disabled, controlled at app level)
DROP POLICY IF EXISTS "Anyone can upload contract templates" ON storage.objects;
CREATE POLICY "Anyone can upload contract templates"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'contract-templates');

-- Allow all users to update templates
DROP POLICY IF EXISTS "Anyone can update contract templates" ON storage.objects;
CREATE POLICY "Anyone can update contract templates"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'contract-templates')
WITH CHECK (bucket_id = 'contract-templates');

-- Allow all users to delete templates
DROP POLICY IF EXISTS "Anyone can delete contract templates" ON storage.objects;
CREATE POLICY "Anyone can delete contract templates"
ON storage.objects
FOR DELETE
USING (bucket_id = 'contract-templates');

-- Allow all users to view templates (public bucket)
DROP POLICY IF EXISTS "Anyone can view contract templates" ON storage.objects;
CREATE POLICY "Anyone can view contract templates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'contract-templates');
