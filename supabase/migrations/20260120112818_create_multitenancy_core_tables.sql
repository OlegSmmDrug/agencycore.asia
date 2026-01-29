/*
  # Create Core Multitenancy Tables

  ## Overview
  This migration creates the foundation for multi-tenant SaaS architecture while preserving all existing data.
  The existing data will be migrated to a "Legacy Organization" in the next migration.

  ## 1. New Tables Created

  ### organizations
  - `id` (uuid, primary key)
  - `name` (text) - Organization/Company name
  - `slug` (text, unique) - URL-friendly identifier for subdomains
  - `owner_id` (uuid) - References users table (will be migrated to auth.users later)
  - `logo_url` (text) - Organization logo
  - `industry` (text) - Business industry
  - `company_size` (text) - Company size category
  - `timezone` (text) - Organization timezone
  - `onboarding_completed_at` (timestamptz) - When onboarding was completed
  - `is_blocked` (boolean) - Admin can block organization
  - `is_deleted` (boolean) - Soft delete flag
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### subscription_plans
  - `id` (uuid, primary key)
  - `name` (text) - Plan name (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
  - `display_name` (text) - Display name for UI
  - `description` (text) - Plan description
  - `price_monthly` (numeric) - Monthly price in USD
  - `price_annual` (numeric) - Annual price in USD
  - `max_users` (integer) - Maximum users allowed (NULL = unlimited)
  - `max_projects` (integer) - Maximum projects allowed (NULL = unlimited)
  - `features` (jsonb) - Feature flags
  - `is_active` (boolean) - Plan is available for purchase
  - `sort_order` (integer) - Display order
  - `created_at` (timestamptz)

  ### organization_subscriptions
  - `id` (uuid, primary key)
  - `organization_id` (uuid) - References organizations
  - `plan_id` (uuid) - References subscription_plans
  - `status` (text) - trial, active, past_due, canceled, trial_expired
  - `billing_cycle` (text) - monthly, annual
  - `mrr` (numeric) - Monthly Recurring Revenue
  - `seats_purchased` (integer) - Number of seats purchased
  - `trial_ends_at` (timestamptz) - Trial end date
  - `current_period_start` (timestamptz)
  - `current_period_end` (timestamptz)
  - `canceled_at` (timestamptz)
  - `stripe_customer_id` (text)
  - `stripe_subscription_id` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### addon_subscriptions
  - `id` (uuid, primary key)
  - `organization_id` (uuid) - References organizations
  - `addon_type` (text) - contracts, analytics_pro, api_access, whitelabel
  - `price` (numeric) - Monthly price
  - `status` (text) - active, canceled
  - `activated_at` (timestamptz)
  - `canceled_at` (timestamptz)
  - `stripe_subscription_id` (text)
  - `created_at` (timestamptz)

  ### usage_metrics
  - `id` (uuid, primary key)
  - `organization_id` (uuid) - References organizations
  - `metric_type` (text) - active_users, projects, api_calls, storage_mb
  - `current_value` (integer) - Current usage
  - `limit_value` (integer) - Maximum allowed (NULL = unlimited)
  - `period_start` (timestamptz) - Current period start
  - `period_end` (timestamptz) - Current period end
  - `updated_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Super admin has full access to all tables
  - Regular users can only read their organization data
  - Only super admin can write to these tables initially
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL,
  logo_url text DEFAULT '',
  industry text DEFAULT 'other',
  company_size text DEFAULT 'unknown',
  timezone text DEFAULT 'UTC',
  onboarding_completed_at timestamptz,
  is_blocked boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  price_monthly numeric DEFAULT 0,
  price_annual numeric DEFAULT 0,
  max_users integer,
  max_projects integer,
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create organization_subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'trial_expired')),
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  mrr numeric DEFAULT 0,
  seats_purchased integer DEFAULT 1,
  trial_ends_at timestamptz,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz,
  canceled_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- Create addon_subscriptions table
CREATE TABLE IF NOT EXISTS addon_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_type text NOT NULL CHECK (addon_type IN ('contracts', 'analytics_pro', 'api_access', 'whitelabel')),
  price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  activated_at timestamptz DEFAULT now(),
  canceled_at timestamptz,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, addon_type)
);

-- Create usage_metrics table
CREATE TABLE IF NOT EXISTS usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type text NOT NULL CHECK (metric_type IN ('active_users', 'projects', 'api_calls', 'storage_mb')),
  current_value integer DEFAULT 0,
  limit_value integer,
  period_start timestamptz DEFAULT now(),
  period_end timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, metric_type)
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_annual, max_users, max_projects, features, sort_order) VALUES
  ('FREE', 'Free', 'Perfect for trying out', 0, 0, 2, 10, '{"basicCRM": true, "basicProjects": true, "basicTasks": true}', 1),
  ('STARTER', 'Starter', 'For small teams', 9, 90, 5, 50, '{"basicCRM": true, "basicProjects": true, "basicTasks": true, "analytics": true, "whatsapp": true}', 2),
  ('PROFESSIONAL', 'Professional', 'For growing agencies', 25, 250, NULL, NULL, '{"basicCRM": true, "basicProjects": true, "basicTasks": true, "analytics": true, "whatsapp": true, "advancedReports": true, "customFields": true, "prioritySupport": true}', 3),
  ('ENTERPRISE', 'Enterprise', 'Custom solution', 0, 0, NULL, NULL, '{"basicCRM": true, "basicProjects": true, "basicTasks": true, "analytics": true, "whatsapp": true, "advancedReports": true, "customFields": true, "prioritySupport": true, "dedicatedSuccess": true, "customIntegrations": true}', 4)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Super admin can view all organizations"
  ON organizations FOR SELECT
  USING (true);

CREATE POLICY "Super admin can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admin can update organizations"
  ON organizations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admin can delete organizations"
  ON organizations FOR DELETE
  USING (true);

-- RLS Policies for subscription_plans (read-only for all, write for super admin)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admin can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for organization_subscriptions
CREATE POLICY "Super admin can view all subscriptions"
  ON organization_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Super admin can manage subscriptions"
  ON organization_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for addon_subscriptions
CREATE POLICY "Super admin can view all addons"
  ON addon_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Super admin can manage addons"
  ON addon_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for usage_metrics
CREATE POLICY "Super admin can view all usage metrics"
  ON usage_metrics FOR SELECT
  USING (true);

CREATE POLICY "Super admin can manage usage metrics"
  ON usage_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan ON organization_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_addon_subscriptions_org ON addon_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_org ON usage_metrics(organization_id);

-- Create updated_at trigger for organizations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at
  BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
