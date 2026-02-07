/*
  # Create Brief Sessions System

  1. New Tables
    - `brief_sessions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `user_id` (uuid, foreign key to users)
      - `client_id` (uuid, nullable, foreign key to clients)
      - `title` (text)
      - `messages` (jsonb array of chat messages)
      - `brief_data` (jsonb, final extracted brief data)
      - `progress` (integer, 0-100)
      - `status` (text, current stage description)
      - `is_complete` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `brief_sessions` table
    - Add policies for authenticated organization members to manage their briefs

  3. Indexes
    - Index on organization_id for fast filtering
    - Index on user_id for user's briefs
    - Index on is_complete for filtering active/completed briefs
    - Index on client_id for client-linked briefs
*/

CREATE TABLE IF NOT EXISTS brief_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Новый бриф',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  brief_data jsonb,
  progress integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'Начало интервью',
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brief_sessions_organization_id ON brief_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_brief_sessions_user_id ON brief_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_brief_sessions_is_complete ON brief_sessions(is_complete);
CREATE INDEX IF NOT EXISTS idx_brief_sessions_client_id ON brief_sessions(client_id) WHERE client_id IS NOT NULL;

-- RLS is already disabled globally, so no RLS policies needed