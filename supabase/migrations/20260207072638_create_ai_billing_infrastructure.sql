/*
  # AI Billing Infrastructure

  This migration creates the core tables and columns needed for the centralized
  AI billing system. The platform moves from a "bring your own API key" model
  to a centralized service where the super admin holds the master Anthropic key
  and organizations purchase AI credits.

  1. New Tables
    - `ai_model_pricing`
      - `id` (uuid, primary key)
      - `model_slug` (text, unique) -- Anthropic model identifier
      - `display_name` (text) -- Human-readable name
      - `input_price_per_1m` (numeric) -- Cost per 1M input tokens in credits
      - `output_price_per_1m` (numeric) -- Cost per 1M output tokens in credits
      - `markup_multiplier` (numeric, default 1.3) -- Markup applied to base cost
      - `is_active` (boolean) -- Whether model is available
      - `sort_order` (integer)
      - `created_at`, `updated_at` (timestamptz)

    - `ai_credit_transactions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid) -- Organization charged
      - `user_id` (uuid) -- User who made the request
      - `request_id` (text, unique) -- Unique request identifier
      - `model_slug` (text) -- Model used
      - `input_tokens` (integer) -- Input tokens consumed
      - `output_tokens` (integer) -- Output tokens consumed
      - `base_cost` (numeric) -- Raw Anthropic cost in credits
      - `markup_cost` (numeric) -- Actual amount deducted (with markup)
      - `balance_before` (numeric) -- Balance before deduction
      - `balance_after` (numeric) -- Balance after deduction
      - `request_summary` (text) -- Brief summary of the request
      - `created_at` (timestamptz)

    - `ai_platform_settings`
      - `id` (uuid, primary key)
      - `master_api_key` (text) -- The super admin's Anthropic API key
      - `default_daily_limit` (numeric, default 1000) -- Default daily spend cap per org
      - `low_balance_threshold_percent` (integer, default 10)
      - `global_ai_enabled` (boolean, default true)
      - `cache_ttl_minutes` (integer, default 60)
      - `credit_price_kzt` (numeric, default 1) -- Price per 1 AI credit in KZT
      - `min_topup_credits` (numeric, default 100)
      - `updated_at` (timestamptz)
      - `updated_by` (uuid)

  2. Modified Tables
    - `organizations`
      - `ai_credit_balance` (numeric, default 0, >= 0) -- AI credit balance
      - `ai_daily_limit` (numeric, nullable) -- Per-org daily spending cap override
      - `is_ai_enabled` (boolean, default false) -- Whether org can use AI

  3. Security
    - RLS disabled for these tables (consistent with the rest of the project)
    - Access controlled at the application/RPC level

  4. Seed Data
    - Three Claude models with Anthropic's pricing
    - One default row in ai_platform_settings
*/

-- 1. AI Model Pricing table
CREATE TABLE IF NOT EXISTS ai_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  input_price_per_1m numeric NOT NULL DEFAULT 0,
  output_price_per_1m numeric NOT NULL DEFAULT 0,
  markup_multiplier numeric NOT NULL DEFAULT 1.3,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. AI Credit Transactions table
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  request_id text UNIQUE NOT NULL,
  model_slug text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  base_cost numeric NOT NULL DEFAULT 0,
  markup_cost numeric NOT NULL DEFAULT 0,
  balance_before numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  request_summary text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 3. AI Platform Settings (singleton config table)
CREATE TABLE IF NOT EXISTS ai_platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_api_key text DEFAULT '',
  default_daily_limit numeric NOT NULL DEFAULT 1000,
  low_balance_threshold_percent integer NOT NULL DEFAULT 10,
  global_ai_enabled boolean NOT NULL DEFAULT true,
  cache_ttl_minutes integer NOT NULL DEFAULT 60,
  credit_price_kzt numeric NOT NULL DEFAULT 1,
  min_topup_credits numeric NOT NULL DEFAULT 100,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- 4. Add columns to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'ai_credit_balance'
  ) THEN
    ALTER TABLE organizations ADD COLUMN ai_credit_balance numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'ai_daily_limit'
  ) THEN
    ALTER TABLE organizations ADD COLUMN ai_daily_limit numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'is_ai_enabled'
  ) THEN
    ALTER TABLE organizations ADD COLUMN is_ai_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add non-negative constraint for ai_credit_balance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_ai_credit_balance_non_negative'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_ai_credit_balance_non_negative CHECK (ai_credit_balance >= 0);
  END IF;
END $$;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_org_id ON ai_credit_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_user_id ON ai_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_created_at ON ai_credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_org_date ON ai_credit_transactions(organization_id, created_at);

-- 6. Seed AI model pricing with current Anthropic rates (in USD cents as credits)
-- Pricing: Claude Sonnet 4 = $3/1M input, $15/1M output
--          Claude Haiku 4.5 = $1/1M input, $5/1M output
--          Claude Sonnet 4.5 = $3/1M input, $15/1M output
INSERT INTO ai_model_pricing (model_slug, display_name, input_price_per_1m, output_price_per_1m, markup_multiplier, is_active, sort_order)
VALUES
  ('claude-sonnet-4-20250514', 'Claude Sonnet 4', 3.0, 15.0, 1.3, true, 1),
  ('claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 1.0, 5.0, 1.3, true, 2),
  ('claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5', 3.0, 15.0, 1.3, true, 3)
ON CONFLICT (model_slug) DO NOTHING;

-- 7. Seed default platform settings (single row)
INSERT INTO ai_platform_settings (master_api_key, default_daily_limit, global_ai_enabled, credit_price_kzt, min_topup_credits)
SELECT '', 1000, true, 450, 100
WHERE NOT EXISTS (SELECT 1 FROM ai_platform_settings);

-- 8. Enable AI for organizations that already have an active claude_api integration
UPDATE organizations
SET is_ai_enabled = true
WHERE id IN (
  SELECT DISTINCT organization_id FROM integrations
  WHERE integration_type = 'claude_api' AND is_active = true
);
