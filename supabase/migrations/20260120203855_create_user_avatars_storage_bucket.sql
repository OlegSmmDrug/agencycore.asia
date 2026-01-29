/*
  # Create User Avatars Storage Bucket

  1. New Storage Bucket
    - `user-avatars` - Public bucket for storing user profile photos
    - Max file size: 5 MB
    - Allowed formats: JPG, PNG, GIF, WebP

  2. Security
    - Public read access for all avatars
    - Any authenticated user can upload/update avatars
    - Users can delete their own avatars
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view all user avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated users can update avatars"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'user-avatars')
  WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated users can delete avatars"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'user-avatars');
