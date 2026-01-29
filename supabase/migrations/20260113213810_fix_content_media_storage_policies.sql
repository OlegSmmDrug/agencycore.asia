/*
  # Fix content-media storage bucket RLS policies

  1. Changes
    - Remove authenticated-only restrictions
    - Allow public INSERT/UPDATE/DELETE operations
    - Keep bucket public for easy content sharing
    
  2. Reasoning
    - Application uses custom authentication without Supabase Auth
    - Files need to be uploadable by logged-in application users
    - Public bucket already allows read access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload content media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update content media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete content media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view content media" ON storage.objects;

-- Allow public to upload content media
CREATE POLICY "Anyone can upload content media"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'content-media');

-- Allow public to update content media
CREATE POLICY "Anyone can update content media"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'content-media')
WITH CHECK (bucket_id = 'content-media');

-- Allow public to delete content media
CREATE POLICY "Anyone can delete content media"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'content-media');

-- Allow public read access to content media
CREATE POLICY "Anyone can view content media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'content-media');
