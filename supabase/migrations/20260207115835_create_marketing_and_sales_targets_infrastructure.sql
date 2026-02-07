/*
  # Marketing Channels, Spend Tracking & Sales Targets

  1. New Tables
    - `marketing_channels`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK -> organizations)
      - `name` (text) - channel display name (e.g. "Google Ads", "SEO")
      - `channel_type` (text) - paid / organic / referral
      - `monthly_budget` (numeric) - planned monthly budget
      - `is_active` (boolean) - whether channel is active
      - `integration_id` (uuid, nullable FK -> integrations)
      - `icon` (text) - icon identifier for UI
      - `color` (text) - hex color for charts
      - `created_at` (timestamptz)

    - `marketing_spend`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK -> organizations)
      - `channel_id` (uuid, FK -> marketing_channels)
      - `month` (text) - YYYY-MM format
      - `amount` (numeric) - actual spend
      - `leads_count` (integer) - leads generated
      - `impressions` (integer) - ad impressions
      - `clicks` (integer) - ad clicks
      - `conversions` (integer) - conversions
      - `notes` (text) - optional notes
      - `created_at` (timestamptz)

    - `sales_targets`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK -> organizations)
      - `user_id` (uuid, FK -> users)
      - `month` (text) - YYYY-MM format
      - `revenue_target` (numeric) - revenue goal
      - `leads_target` (integer) - leads goal
      - `conversion_target` (numeric) - conversion rate goal (%)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS disabled (matches project convention for simple auth)

  3. Important Notes
    - marketing_spend has unique constraint on (organization_id, channel_id, month)
    - sales_targets has unique constraint on (organization_id, user_id, month)
    - Indexes on organization_id for all tables
*/

CREATE TABLE IF NOT EXISTS marketing_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'paid',
  monthly_budget numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  icon text DEFAULT '',
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_channels_org ON marketing_channels(organization_id);

ALTER TABLE marketing_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES marketing_channels(id) ON DELETE CASCADE,
  month text NOT NULL,
  amount numeric DEFAULT 0,
  leads_count integer DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_spend_unique
  ON marketing_spend(organization_id, channel_id, month);
CREATE INDEX IF NOT EXISTS idx_marketing_spend_org ON marketing_spend(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketing_spend_month ON marketing_spend(month);

ALTER TABLE marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  month text NOT NULL,
  revenue_target numeric DEFAULT 0,
  leads_target integer DEFAULT 0,
  conversion_target numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_targets_unique
  ON sales_targets(organization_id, user_id, month);
CREATE INDEX IF NOT EXISTS idx_sales_targets_org ON sales_targets(organization_id);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE marketing_channels DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE marketing_spend DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sales_targets DISABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
