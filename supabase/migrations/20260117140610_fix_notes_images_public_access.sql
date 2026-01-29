/*
  # Fix Notes Images Storage Public Access

  1. Changes
    - Update INSERT policy to allow public uploads (not just authenticated)
    - This aligns with the app's custom authentication system
    
  2. Security
    - Public bucket remains readable by anyone
    - Anyone can upload images (like other public buckets in the app)
*/

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload notes images" ON storage.objects;

-- Allow public uploads to notes-images bucket
CREATE POLICY "Public can upload notes images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'notes-images');

-- Update UPDATE policy to be public
DROP POLICY IF EXISTS "Users can update own notes images" ON storage.objects;
CREATE POLICY "Public can update notes images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'notes-images');

-- Update DELETE policy to be public
DROP POLICY IF EXISTS "Users can delete own notes images" ON storage.objects;
CREATE POLICY "Public can delete notes images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'notes-images');
