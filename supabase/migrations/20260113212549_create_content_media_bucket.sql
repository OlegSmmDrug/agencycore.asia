/*
  # Create content-media storage bucket

  1. Storage
    - Create public bucket named `content-media` for storing task content (photos, videos)
    - Set file size limit to 100MB for video support
    - Allow authenticated users to upload and manage content
    - Allow public read access for client preview

  2. Security
    - Public bucket for easy content preview
    - RLS policies to control upload/delete operations
    - Team members can upload/delete
    - Clients (guest users) can only read

  3. Organization
    - Files organized by: {project_id}/{task_id}/{timestamp}_{filename}
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-media', 'content-media', true, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload content media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload content media'
  ) THEN
    CREATE POLICY "Authenticated users can upload content media"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'content-media');
  END IF;
END $$;

-- Allow authenticated users to update content media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can update content media'
  ) THEN
    CREATE POLICY "Authenticated users can update content media"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'content-media')
    WITH CHECK (bucket_id = 'content-media');
  END IF;
END $$;

-- Allow authenticated users to delete content media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can delete content media'
  ) THEN
    CREATE POLICY "Authenticated users can delete content media"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'content-media');
  END IF;
END $$;

-- Allow public read access to content media (for client preview)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public can view content media'
  ) THEN
    CREATE POLICY "Public can view content media"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'content-media');
  END IF;
END $$;
