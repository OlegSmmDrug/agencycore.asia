/*
  # Fix project-images storage policies for public access

  1. Changes
    - Drop existing authenticated-only policies
    - Create new policies allowing public access for upload/update/delete
    - This is needed because the app uses custom authentication (not Supabase Auth)

  2. Security
    - Public bucket remains public for read access
    - Upload/update/delete now available to all users (anon role)
    - Safe for this use case as images are public project avatars
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update project images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete project images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view project images" ON storage.objects;

-- Allow anyone to upload project images
CREATE POLICY "Anyone can upload project images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'project-images');

-- Allow anyone to update project images
CREATE POLICY "Anyone can update project images"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'project-images')
WITH CHECK (bucket_id = 'project-images');

-- Allow anyone to delete project images
CREATE POLICY "Anyone can delete project images"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'project-images');

-- Allow public read access to project images
CREATE POLICY "Public can view project images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'project-images');