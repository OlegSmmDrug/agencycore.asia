/*
  # Migrate existing WhatsApp messages data to chats table

  1. Purpose
    - Populate the new whatsapp_chats table with data from existing whatsapp_messages
    - This ensures backward compatibility after adding group chat support
    - Creates chat records for all existing conversations

  2. Process
    - Groups messages by chat_id
    - Creates a chat record for each unique chat_id
    - Extracts chat name from the most recent message
    - Determines chat type (individual or group) based on chat_id format
    - Links to client if available
    - Sets last_message_at to the timestamp of the most recent message
    - Counts unread messages for each chat

  3. Notes
    - Safe to run multiple times (uses INSERT ... ON CONFLICT DO UPDATE)
    - Preserves existing chat records if they already exist
    - Individual chats: chat_id ends with @c.us
    - Group chats: chat_id ends with @g.us
*/

-- Populate whatsapp_chats from existing whatsapp_messages
INSERT INTO whatsapp_chats (
  chat_id,
  chat_name,
  chat_type,
  client_id,
  phone,
  last_message_at,
  unread_count,
  created_at,
  updated_at
)
SELECT DISTINCT ON (m.chat_id)
  m.chat_id,
  COALESCE(
    m.chat_name,
    (SELECT chat_name FROM whatsapp_messages WHERE chat_id = m.chat_id AND chat_name IS NOT NULL LIMIT 1),
    (SELECT sender_name FROM whatsapp_messages WHERE chat_id = m.chat_id AND sender_name IS NOT NULL AND direction = 'incoming' LIMIT 1),
    c.name,
    REPLACE(REPLACE(m.chat_id, '@c.us', ''), '@g.us', '')
  ) as chat_name,
  CASE 
    WHEN m.chat_id LIKE '%@g.us' THEN 'group'
    ELSE 'individual'
  END as chat_type,
  m.client_id,
  CASE 
    WHEN m.chat_id LIKE '%@c.us' THEN REPLACE(m.chat_id, '@c.us', '')
    ELSE NULL
  END as phone,
  (SELECT MAX(timestamp) FROM whatsapp_messages WHERE chat_id = m.chat_id) as last_message_at,
  (SELECT COUNT(*) FROM whatsapp_messages WHERE chat_id = m.chat_id AND direction = 'incoming' AND is_read = false)::integer as unread_count,
  (SELECT MIN(timestamp) FROM whatsapp_messages WHERE chat_id = m.chat_id) as created_at,
  now() as updated_at
FROM whatsapp_messages m
LEFT JOIN clients c ON c.id = m.client_id
WHERE m.chat_id IS NOT NULL AND m.chat_id != ''
GROUP BY m.chat_id, m.client_id, m.chat_name, c.name
ON CONFLICT (chat_id) 
DO UPDATE SET
  chat_name = COALESCE(EXCLUDED.chat_name, whatsapp_chats.chat_name),
  last_message_at = EXCLUDED.last_message_at,
  unread_count = EXCLUDED.unread_count,
  updated_at = now();