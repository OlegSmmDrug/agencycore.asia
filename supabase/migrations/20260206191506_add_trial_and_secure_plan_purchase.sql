/*
  # Add trial infrastructure and secure plan purchase

  1. Modified Tables
    - `organizations`
      - Added `trial_end_date` (timestamptz) - when the trial period ends
      - Added CHECK constraint on balance operations

  2. New Functions
    - `purchase_plan(p_org_id, p_user_id, p_plan_name)` - Atomically purchases a plan:
      - Validates plan exists and gets price
      - Checks user balance >= plan price (in KZT)
      - Deducts balance
      - Logs transaction to balance_transactions
      - Updates organization plan
      - Returns JSON with success/error
    - `check_and_expire_trial(p_org_id)` - Checks if trial expired and downgrades to Free

  3. Security
    - Balance can never go negative (CHECK constraint)
    - Plan purchase is atomic (single transaction)
    - All balance changes are logged in balance_transactions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'trial_end_date'
  ) THEN
    ALTER TABLE organizations ADD COLUMN trial_end_date timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_balance_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION purchase_plan(
  p_org_id uuid,
  p_user_id uuid,
  p_plan_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_user record;
  v_plan_display_name text;
  v_price numeric;
  v_balance_before numeric;
  v_balance_after numeric;
  v_db_plan_name text;
BEGIN
  SELECT name, price_kzt, display_name_ru
  INTO v_plan
  FROM subscription_plans
  WHERE name = UPPER(p_plan_name) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;

  v_price := v_plan.price_kzt;
  v_plan_display_name := v_plan.display_name_ru;

  IF v_price <= 0 THEN
    v_db_plan_name := CASE v_plan.name
      WHEN 'FREE' THEN 'Free'
      WHEN 'STARTER' THEN 'Starter'
      WHEN 'PROFESSIONAL' THEN 'Professional'
      WHEN 'ENTERPRISE' THEN 'Enterprise'
      ELSE p_plan_name
    END;

    UPDATE organizations
    SET plan_name = v_db_plan_name,
        subscription_status = 'active',
        subscription_end_date = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE id = p_org_id;

    RETURN jsonb_build_object('success', true, 'charged', 0);
  END IF;

  SELECT id, balance INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_balance_before := v_user.balance;

  IF v_balance_before < v_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'required', v_price,
      'available', v_balance_before
    );
  END IF;

  v_balance_after := v_balance_before - v_price;

  UPDATE users
  SET balance = v_balance_after
  WHERE id = p_user_id;

  INSERT INTO balance_transactions (
    organization_id, user_id, amount, type, description,
    balance_before, balance_after
  ) VALUES (
    p_org_id, p_user_id, v_price, 'debit',
    'Покупка тарифа ' || v_plan_display_name,
    v_balance_before, v_balance_after
  );

  v_db_plan_name := CASE v_plan.name
    WHEN 'FREE' THEN 'Free'
    WHEN 'STARTER' THEN 'Starter'
    WHEN 'PROFESSIONAL' THEN 'Professional'
    WHEN 'ENTERPRISE' THEN 'Enterprise'
    ELSE p_plan_name
  END;

  UPDATE organizations
  SET plan_name = v_db_plan_name,
      subscription_status = 'active',
      subscription_end_date = NOW() + INTERVAL '30 days',
      trial_end_date = NULL,
      mrr = v_price,
      updated_at = NOW()
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'charged', v_price,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'plan', v_db_plan_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_and_expire_trial(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
BEGIN
  SELECT plan_name, subscription_status, trial_end_date, subscription_end_date
  INTO v_org
  FROM organizations
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'Organization not found');
  END IF;

  IF v_org.subscription_status = 'trial' AND v_org.trial_end_date IS NOT NULL AND v_org.trial_end_date < NOW() THEN
    UPDATE organizations
    SET plan_name = 'Free',
        subscription_status = 'active',
        trial_end_date = NULL,
        subscription_end_date = NULL,
        mrr = 0,
        updated_at = NOW()
    WHERE id = p_org_id;

    RETURN jsonb_build_object('expired', true, 'previous_plan', v_org.plan_name, 'new_plan', 'Free');
  END IF;

  IF v_org.subscription_status = 'active'
    AND v_org.plan_name != 'Free'
    AND v_org.subscription_end_date IS NOT NULL
    AND v_org.subscription_end_date < NOW() THEN

    UPDATE organizations
    SET plan_name = 'Free',
        subscription_status = 'active',
        subscription_end_date = NULL,
        mrr = 0,
        updated_at = NOW()
    WHERE id = p_org_id;

    RETURN jsonb_build_object('expired', true, 'previous_plan', v_org.plan_name, 'new_plan', 'Free');
  END IF;

  RETURN jsonb_build_object('expired', false, 'plan', v_org.plan_name, 'status', v_org.subscription_status);
END;
$$;
