/*
  # Enable Realtime for WhatsApp chats and Evolution instances

  1. Changes
    - Add `whatsapp_chats` to the Supabase Realtime publication
    - Add `evolution_instances` to the Supabase Realtime publication
  
  2. Why
    - WhatsApp chat list needs to update in real-time when new messages arrive
    - Evolution instance connection status changes need to propagate instantly to the UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_chats;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'evolution_instances'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE evolution_instances;
  END IF;
END $$;
