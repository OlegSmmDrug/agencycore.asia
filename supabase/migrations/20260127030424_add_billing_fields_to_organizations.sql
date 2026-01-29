/*
  # Add Billing Fields to Organizations

  1. New Columns
    - `plan_name` (text) - Название тарифного плана (Free, Starter, Professional, Enterprise)
    - `subscription_status` (text) - Статус подписки (active, trial, past_due, canceled, trial_expired)
    - `mrr` (numeric) - Месячный доход от организации (Monthly Recurring Revenue)
    - `subscription_period` (text) - Период подписки (1month, 6months, 9months, 1year, 2years)
    - `additional_users_count` (integer) - Количество дополнительных оплачиваемых пользователей
    - `subscription_start_date` (timestamptz) - Дата начала подписки
    - `subscription_end_date` (timestamptz) - Дата окончания подписки
    - `bonus_months` (integer) - Количество бонусных месяцев

  2. Changes
    - Add billing-related columns to organizations table
    - Set default values for existing organizations
*/

-- Add billing fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS plan_name text DEFAULT 'Free',
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS mrr numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_period text DEFAULT '1month',
ADD COLUMN IF NOT EXISTS additional_users_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz,
ADD COLUMN IF NOT EXISTS bonus_months integer DEFAULT 0;

-- Add check constraints for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organizations_plan_name_check'
  ) THEN
    ALTER TABLE organizations 
    ADD CONSTRAINT organizations_plan_name_check 
    CHECK (plan_name IN ('Free', 'Starter', 'Professional', 'Enterprise'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organizations_subscription_status_check'
  ) THEN
    ALTER TABLE organizations 
    ADD CONSTRAINT organizations_subscription_status_check 
    CHECK (subscription_status IN ('active', 'trial', 'past_due', 'canceled', 'trial_expired'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organizations_subscription_period_check'
  ) THEN
    ALTER TABLE organizations 
    ADD CONSTRAINT organizations_subscription_period_check 
    CHECK (subscription_period IN ('1month', '6months', '9months', '1year', '2years'));
  END IF;
END $$;

-- Add index for faster billing queries
CREATE INDEX IF NOT EXISTS idx_organizations_plan_name ON organizations(plan_name);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_end_date ON organizations(subscription_end_date);