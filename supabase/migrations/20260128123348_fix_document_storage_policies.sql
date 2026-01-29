/*
  # Fix Document Storage Policies

  Since the project uses custom authentication (not Supabase Auth),
  we need to disable RLS on storage buckets or make them accessible.
  
  This migration:
  1. Drops existing restrictive storage policies
  2. Creates permissive policies that allow authenticated access
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view templates in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload templates to their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete templates in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents in their organization" ON storage.objects;

-- Create permissive policies for document-templates bucket
CREATE POLICY "Allow all operations on document-templates"
  ON storage.objects FOR ALL
  USING (bucket_id = 'document-templates');

-- Create permissive policies for generated-documents bucket
CREATE POLICY "Allow all operations on generated-documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'generated-documents');