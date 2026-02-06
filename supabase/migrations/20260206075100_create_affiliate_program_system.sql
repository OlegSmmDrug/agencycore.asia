/*
  # Create Affiliate / Partner Program System

  1. New Tables
    - `promo_codes`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `user_id` (uuid, FK to users)
      - `code` (text, unique) - the promo code string
      - `registrations_count` (integer) - how many orgs registered with this code
      - `payments_count` (integer) - how many of those orgs made a payment
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `referral_registrations`
      - `id` (uuid, primary key)
      - `referrer_user_id` (uuid, FK to users) - who referred
      - `referrer_org_id` (uuid, FK to organizations) - referrer's org
      - `referred_org_id` (uuid, FK to organizations) - the new org that was referred
      - `promo_code_id` (uuid, FK to promo_codes) - which code was used
      - `level` (integer) - referral level (1=direct, 2=second, 3=third)
      - `is_active` (boolean) - whether referred client is active (has paid)
      - `created_at` (timestamptz)

    - `referral_transactions`
      - `id` (uuid, primary key)
      - `referrer_user_id` (uuid) - who earns commission
      - `referrer_org_id` (uuid)
      - `referred_org_id` (uuid) - which org's payment generated this
      - `payment_amount` (numeric) - original payment amount
      - `commission_percent` (numeric) - commission rate applied
      - `commission_amount` (numeric) - actual commission earned
      - `level` (integer) - from which referral level
      - `status` (text) - pending / ready / paid
      - `ready_at` (timestamptz) - when funds become available (14 days after)
      - `paid_at` (timestamptz)
      - `created_at` (timestamptz)

    - `referral_payouts`
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `organization_id` (uuid)
      - `amount` (numeric)
      - `status` (text) - pending / processing / paid / rejected
      - `bank_details` (text)
      - `requested_at` (timestamptz)
      - `processed_at` (timestamptz)

  2. Changes to existing tables
    - Add `referred_by_promo_code` to `organizations` to track which promo was used at registration
    - Add `trial_extended_until` to `organizations` for extended trial tracking

  3. Security
    - RLS disabled (consistent with existing approach in this codebase)
*/

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL,
  registrations_count integer DEFAULT 0,
  payments_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT promo_codes_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_org ON promo_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_user ON promo_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- Referral registrations table
CREATE TABLE IF NOT EXISTS referral_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referred_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  level integer DEFAULT 1,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_regs_referrer ON referral_registrations(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_regs_referrer_org ON referral_registrations(referrer_org_id);
CREATE INDEX IF NOT EXISTS idx_referral_regs_referred_org ON referral_registrations(referred_org_id);

-- Referral transactions (commission earnings)
CREATE TABLE IF NOT EXISTS referral_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referred_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  level integer DEFAULT 1,
  status text DEFAULT 'pending',
  ready_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_tx_referrer ON referral_transactions(referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_tx_referrer_org ON referral_transactions(referrer_org_id);

-- Referral payouts (withdrawal requests)
CREATE TABLE IF NOT EXISTS referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  status text DEFAULT 'pending',
  bank_details text DEFAULT '',
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_user ON referral_payouts(user_id, status);

-- Add referred_by_promo_code to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'referred_by_promo_code'
  ) THEN
    ALTER TABLE organizations ADD COLUMN referred_by_promo_code text DEFAULT '';
  END IF;
END $$;

-- Add trial_extended_until to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'trial_extended_until'
  ) THEN
    ALTER TABLE organizations ADD COLUMN trial_extended_until timestamptz;
  END IF;
END $$;
