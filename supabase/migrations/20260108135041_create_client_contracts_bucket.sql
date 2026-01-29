/*
  # Create client-contracts storage bucket

  1. Storage
    - Create private bucket named `client-contracts` for storing uploaded contract files
    - Set file size limit to 10MB (enough for PDF/DOCX files)
    - Allow authenticated users to upload and manage contract documents

  2. Security
    - Private bucket for confidential contract documents
    - RLS policies to control upload/update/delete operations
    - Authenticated users can access their uploaded contracts
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-contracts', 'client-contracts', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload client contracts'
  ) THEN
    CREATE POLICY "Authenticated users can upload client contracts"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'client-contracts');
  END IF;
END $$;

-- Allow authenticated users to update contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update client contracts'
  ) THEN
    CREATE POLICY "Authenticated users can update client contracts"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'client-contracts')
    WITH CHECK (bucket_id = 'client-contracts');
  END IF;
END $$;

-- Allow authenticated users to delete contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete client contracts'
  ) THEN
    CREATE POLICY "Authenticated users can delete client contracts"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'client-contracts');
  END IF;
END $$;

-- Allow authenticated users to view contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view client contracts'
  ) THEN
    CREATE POLICY "Authenticated users can view client contracts"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'client-contracts');
  END IF;
END $$;