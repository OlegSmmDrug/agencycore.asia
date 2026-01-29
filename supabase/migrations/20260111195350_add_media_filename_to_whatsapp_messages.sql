/*
  # Add Media Filename Field

  1. Changes
    - Add `media_filename` column to whatsapp_messages table
    - This allows storing original file names for downloaded files
  
  2. Security
    - Uses existing RLS policies (public access)
*/

-- Add media_filename field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'media_filename'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN media_filename text;
  END IF;
END $$;
