/*
  # WhatsApp Integration via Wazzup24
  
  This migration adds tables needed for WhatsApp messaging integration.
  
  1. New Tables
    - `wazzup_channels` - Stores connected WhatsApp channels/numbers
      - id (uuid, primary key)
      - channel_id (text) - Wazzup24 channel ID
      - channel_name (text) - Display name
      - phone_number (text) - WhatsApp phone number
      - status (text) - active/disconnected/pending
      - qr_code (text) - QR code for connection
      - last_sync (timestamptz) - Last sync timestamp
      
    - `whatsapp_messages` - Stores all WhatsApp messages
      - id (uuid, primary key)
      - client_id (uuid, FK -> clients) - Related client
      - message_id (text) - Wazzup24 message ID
      - direction (text) - incoming/outgoing
      - content (text) - Message text
      - sender_name (text) - Sender display name
      - user_id (uuid, FK -> users) - Manager who sent (if outgoing)
      - status (text) - sent/delivered/read/failed
      - timestamp (timestamptz) - Message timestamp
      - media_url (text) - URL for media attachments
      - media_type (text) - image/video/audio/document
      - channel_id (text) - Wazzup24 channel ID
      - chat_id (text) - Wazzup24 chat ID
      - is_read (boolean) - Whether message was read by manager
      
    - `whatsapp_templates` - Message templates for quick replies
      - id (uuid, primary key)
      - name (text) - Template name
      - content (text) - Template text with variables
      - category (text) - Category for organization
      - created_by (uuid, FK -> users)
      
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    
  3. Indexes
    - Index on client_id for fast message lookup
    - Index on timestamp for chronological ordering
    - Index on chat_id for Wazzup24 lookups
*/

-- Wazzup Channels table
CREATE TABLE IF NOT EXISTS wazzup_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text UNIQUE NOT NULL,
  channel_name text NOT NULL DEFAULT 'WhatsApp Channel',
  phone_number text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  qr_code text DEFAULT '',
  transport text DEFAULT 'whatsapp',
  last_sync timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wazzup_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view channels"
  ON wazzup_channels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage channels"
  ON wazzup_channels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- WhatsApp Messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  message_id text,
  direction text NOT NULL DEFAULT 'outgoing',
  content text NOT NULL DEFAULT '',
  sender_name text DEFAULT '',
  user_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'sent',
  timestamp timestamptz DEFAULT now(),
  media_url text DEFAULT '',
  media_type text DEFAULT '',
  channel_id text DEFAULT '',
  chat_id text DEFAULT '',
  chat_type text DEFAULT 'whatsapp',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert messages"
  ON whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update messages"
  ON whatsapp_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- WhatsApp Templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates"
  ON whatsapp_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage templates"
  ON whatsapp_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client_id ON whatsapp_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_read ON whatsapp_messages(is_read) WHERE is_read = false;

-- Add some default templates
INSERT INTO whatsapp_templates (name, content, category) VALUES
  ('Приветствие', 'Здравствуйте, {name}! Спасибо за обращение в нашу компанию. Чем могу помочь?', 'greeting'),
  ('Напоминание об оплате', 'Добрый день, {name}! Напоминаем о предстоящем платеже по договору. С уважением, команда агентства.', 'payment'),
  ('Подтверждение встречи', 'Здравствуйте! Подтверждаем нашу встречу на {date}. До встречи!', 'meeting'),
  ('Благодарность', 'Спасибо за сотрудничество, {name}! Будем рады продолжить работу с вами.', 'thanks')
ON CONFLICT DO NOTHING;