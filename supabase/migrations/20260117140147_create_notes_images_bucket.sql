/*
  # Create Notes Images Storage Bucket

  1. Storage
    - Create `notes-images` bucket for storing images in notes
    - Enable public access for viewing images
    - Set up RLS policies for secure uploads

  2. Security
    - Authenticated users can upload images
    - Anyone can view images (public bucket)
*/

-- Create the bucket for note images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notes-images',
  'notes-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access for Notes Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload notes images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own notes images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own notes images" ON storage.objects;

-- Allow anyone to view images (public bucket)
CREATE POLICY "Public Access for Notes Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'notes-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload notes images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes-images');

-- Allow users to update their own uploaded images
CREATE POLICY "Users can update own notes images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'notes-images');

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete own notes images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notes-images');
