/*
  # Enable Realtime for Clients Table

  1. Changes
    - Enable real-time subscriptions for the clients table
    - This allows frontend to receive instant updates when new clients are created via webhook

  2. Security
    - Realtime respects existing RLS policies
    - Only authenticated users will receive updates
*/

-- Enable realtime for clients table
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
