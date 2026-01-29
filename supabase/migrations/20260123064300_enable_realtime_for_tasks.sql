/*
  # Enable Realtime for Tasks Table
  
  ## Changes
  Enable Realtime subscriptions for the tasks table by setting replica identity to FULL.
  This allows the frontend to receive real-time updates when tasks are created, updated, or deleted.
  
  ## Why This Is Needed
  Without this setting, Realtime subscriptions only receive minimal data on updates,
  making it impossible to sync task changes in real-time across multiple clients.
*/

ALTER TABLE tasks REPLICA IDENTITY FULL;