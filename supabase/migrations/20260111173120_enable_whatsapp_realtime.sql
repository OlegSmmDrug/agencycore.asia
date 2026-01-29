/*
  # Enable Realtime for WhatsApp Messages

  1. Changes
    - Enable realtime replication for whatsapp_messages table
    - This allows real-time updates in the UI when new messages arrive

  2. Security
    - Maintains existing RLS policies
    - Only authenticated users can see messages in real-time
*/

-- Enable realtime for whatsapp_messages
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
