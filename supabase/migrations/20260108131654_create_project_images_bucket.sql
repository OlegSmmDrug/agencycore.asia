/*
  # Create project-images storage bucket

  1. Storage
    - Create public bucket named `project-images` for storing project avatar images
    - Set file size limit to 5MB
    - Allow authenticated users to upload and manage their project images

  2. Security
    - Public bucket for easy access to project images
    - RLS policies to control upload/delete operations
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-images', 'project-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload project images'
  ) THEN
    CREATE POLICY "Authenticated users can upload project images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'project-images');
  END IF;
END $$;

-- Allow authenticated users to update their project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update project images'
  ) THEN
    CREATE POLICY "Authenticated users can update project images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'project-images')
    WITH CHECK (bucket_id = 'project-images');
  END IF;
END $$;

-- Allow authenticated users to delete their project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete project images'
  ) THEN
    CREATE POLICY "Authenticated users can delete project images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'project-images');
  END IF;
END $$;

-- Allow public read access to project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view project images'
  ) THEN
    CREATE POLICY "Public can view project images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'project-images');
  END IF;
END $$;