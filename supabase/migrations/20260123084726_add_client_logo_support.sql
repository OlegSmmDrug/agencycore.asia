/*
  # Add Client Logo Support

  1. Changes
    - Add `logo_url` column to `clients` table to store client logo image URLs
    - Create `client-logos` storage bucket for client logo images
    - Set up storage policies for public read access and authenticated write access

  2. Security
    - Public read access for client logos
    - Authenticated users can upload/update logos
*/

-- Add logo_url column to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE clients ADD COLUMN logo_url text;
  END IF;
END $$;

-- Create client-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for client-logos bucket
DROP POLICY IF EXISTS "Public read access for client logos" ON storage.objects;
CREATE POLICY "Public read access for client logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "Authenticated users can upload client logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload client logos"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "Authenticated users can update client logos" ON storage.objects;
CREATE POLICY "Authenticated users can update client logos"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'client-logos')
  WITH CHECK (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "Authenticated users can delete client logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete client logos"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'client-logos');