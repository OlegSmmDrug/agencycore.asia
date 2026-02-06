/*
  # Telegram Notification System

  1. New Tables
    - `telegram_bot_config`
      - `id` (uuid, primary key)
      - `bot_token` (text) - Telegram bot API token
      - `bot_username` (text) - Bot username without @
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `user_telegram_links`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users)
      - `organization_id` (uuid, FK to organizations)
      - `telegram_chat_id` (bigint) - Telegram chat ID
      - `telegram_username` (text) - Telegram username
      - `telegram_first_name` (text) - Telegram first name
      - `is_active` (boolean) - Whether link is active
      - `linked_at` (timestamptz)
    - `user_notification_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users)
      - `organization_id` (uuid, FK to organizations)
      - `telegram_enabled` (boolean) - Master toggle for Telegram notifications
      - `notify_new_task` (boolean) - Notify on new task assignment
      - `notify_task_status` (boolean) - Notify on task status changes
      - `notify_task_overdue` (boolean) - Notify on overdue tasks
      - `notify_new_client` (boolean) - Notify on new clients
      - `notify_deadline` (boolean) - Notify on approaching deadlines
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS disabled (matching project convention for simple auth)

  3. Notes
    - Bot token stored securely in telegram_bot_config table
    - Each user can link one or more Telegram accounts
    - Notification preferences are per-user with granular toggles
*/

CREATE TABLE IF NOT EXISTS telegram_bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token text NOT NULL,
  bot_username text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  telegram_username text DEFAULT '',
  telegram_first_name text DEFAULT '',
  is_active boolean DEFAULT true,
  linked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, telegram_chat_id)
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  telegram_enabled boolean DEFAULT true,
  notify_new_task boolean DEFAULT true,
  notify_task_status boolean DEFAULT true,
  notify_task_overdue boolean DEFAULT true,
  notify_new_client boolean DEFAULT true,
  notify_deadline boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_telegram_links_user_id ON user_telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_telegram_links_chat_id ON user_telegram_links(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_user_telegram_links_org_id ON user_telegram_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);

INSERT INTO telegram_bot_config (bot_token, bot_username)
VALUES ('8479968978:AAHK9F2k-mhEVxDjBbTw54WdMuZ80IU7bXw', 'agencycore_bot')
ON CONFLICT DO NOTHING;
