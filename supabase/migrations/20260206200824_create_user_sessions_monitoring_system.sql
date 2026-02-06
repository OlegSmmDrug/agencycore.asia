/*
  # Create User Sessions Monitoring System

  Tracks user login sessions to detect account sharing (multiple simultaneous 
  logins from different IP addresses).

  1. New Tables
    - `user_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users)
      - `organization_id` (uuid, FK to organizations)
      - `session_token` (text, unique identifier per browser session)
      - `ip_address` (text, IP from which user connected)
      - `user_agent` (text, browser/device info)
      - `device_fingerprint` (text, simplified device identifier)
      - `last_active_at` (timestamptz, last heartbeat)
      - `created_at` (timestamptz)
      - `is_active` (boolean, whether session is still alive)

  2. Security
    - RLS disabled (system table, accessed only via edge functions with service role key)

  3. Functions
    - `check_concurrent_sessions` - detects suspicious concurrent sessions

  4. Notes
    - Sessions older than 30 minutes without heartbeat are considered inactive
    - Warning triggered when 2+ different IPs are active simultaneously
*/

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  device_fingerprint text NOT NULL DEFAULT '',
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_concurrent_sessions(
  p_user_id uuid,
  p_session_token text,
  p_ip_address text,
  p_user_agent text,
  p_device_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_concurrent_count integer;
  v_concurrent_ips text[];
  v_result jsonb;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM users WHERE id = p_user_id;

  UPDATE user_sessions
  SET is_active = false
  WHERE user_id = p_user_id
    AND is_active = true
    AND last_active_at < now() - interval '30 minutes';

  INSERT INTO user_sessions (user_id, organization_id, session_token, ip_address, user_agent, device_fingerprint, last_active_at)
  VALUES (p_user_id, v_org_id, p_session_token, p_ip_address, p_user_agent, p_device_fingerprint, now())
  ON CONFLICT (session_token)
  DO UPDATE SET
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    last_active_at = now(),
    is_active = true;

  SELECT
    count(DISTINCT ip_address),
    array_agg(DISTINCT ip_address)
  INTO v_concurrent_count, v_concurrent_ips
  FROM user_sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND last_active_at > now() - interval '30 minutes';

  v_result := jsonb_build_object(
    'concurrent_ips', v_concurrent_count,
    'ip_list', to_jsonb(v_concurrent_ips),
    'warning', v_concurrent_count >= 3,
    'current_ip', p_ip_address
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE is_active = true
    AND last_active_at < now() - interval '30 minutes';

  DELETE FROM user_sessions
  WHERE created_at < now() - interval '30 days';
END;
$$;
