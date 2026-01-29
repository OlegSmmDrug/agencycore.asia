/*
  # Add support for WhatsApp group chats

  1. Changes to `whatsapp_messages` table
    - Add `chat_name` column to store the name of the chat (particularly for groups)
    - This allows displaying group chat names properly

  2. New `whatsapp_chats` table
    - `id` (uuid, primary key)
    - `chat_id` (text, unique) - WhatsApp chat ID (e.g., "77001234567@c.us" or "120363123456789@g.us" for groups)
    - `chat_name` (text) - Display name of the chat
    - `chat_type` (text) - 'individual' or 'group'
    - `client_id` (uuid, FK to clients, nullable) - For individual chats linked to clients
    - `phone` (text, nullable) - Phone number for individual chats
    - `last_message_at` (timestamptz) - Timestamp of last message
    - `unread_count` (integer) - Number of unread messages
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on `whatsapp_chats` table
    - Add public access policies for authenticated users

  4. Notes
    - Group chats don't need to be linked to clients
    - This allows users to see and interact with all WhatsApp chats (individual and group)
    - The system will automatically create chat records when messages arrive
*/

-- Add chat_name column to whatsapp_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'chat_name'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN chat_name text;
  END IF;
END $$;

-- Create whatsapp_chats table
CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text UNIQUE NOT NULL,
  chat_name text NOT NULL,
  chat_type text NOT NULL DEFAULT 'individual',
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  phone text,
  last_message_at timestamptz,
  unread_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to whatsapp_chats"
  ON whatsapp_chats FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to whatsapp_chats"
  ON whatsapp_chats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to whatsapp_chats"
  ON whatsapp_chats FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from whatsapp_chats"
  ON whatsapp_chats FOR DELETE
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_chat_id ON whatsapp_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_client_id ON whatsapp_chats(client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_last_message_at ON whatsapp_chats(last_message_at DESC);