/*
  # Create WhatsApp Media Storage Bucket

  1. Storage
    - Create `whatsapp-media` bucket for storing sent media files
    - Enable public access for media files
    - Set up RLS policies for authenticated uploads

  2. Purpose
    - Store images, videos, audio, and documents sent through WhatsApp
    - Provide permanent URLs for media preview in the interface
    - Keep media files accessible even after WhatsApp session ends
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  16777216,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view whatsapp media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Public can view whatsapp media files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'whatsapp-media');
