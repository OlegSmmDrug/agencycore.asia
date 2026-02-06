/*
  # Telegram Link Verification Codes

  Security improvement: instead of linking by email (anyone who knows the email
  can hijack notifications), users now generate a one-time code in the CRM
  and enter it in the Telegram bot to verify ownership.

  1. New Tables
    - `telegram_link_codes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users) - the user who generated the code
      - `organization_id` (uuid, FK to organizations)
      - `code` (text, unique) - 6-digit verification code
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz) - code expires after 10 minutes

  2. Notes
    - Codes are single-use and expire after 10 minutes
    - Only the authenticated user in CRM can generate their own code
    - Old expired codes are cleaned up on new code generation
*/

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '10 minutes'
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user_id ON telegram_link_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires ON telegram_link_codes(expires_at);
