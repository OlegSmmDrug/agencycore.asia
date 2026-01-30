/*
  # Fix User Avatars Storage Policies
  
  Since the project uses custom authentication (not Supabase Auth),
  the storage policies need to be updated to allow access without
  requiring Supabase Auth.
  
  This migration:
  1. Drops existing restrictive storage policies
  2. Creates permissive policies that allow all operations
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public can view all user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

-- Create permissive policy for all operations on user-avatars bucket
CREATE POLICY "Allow all operations on user-avatars"
  ON storage.objects FOR ALL
  USING (bucket_id = 'user-avatars');
