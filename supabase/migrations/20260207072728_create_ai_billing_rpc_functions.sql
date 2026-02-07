/*
  # AI Billing RPC Functions

  Creates atomic functions for AI credit operations:

  1. `deduct_ai_credits` -- Called by the Edge Function after a successful API call.
     Atomically checks balance, deducts cost with markup, and logs the transaction.

  2. `topup_ai_credits` -- Called by super admin or system to credit AI balance
     to an organization. Logs the operation.

  3. `purchase_ai_credits` -- Called by organization users to buy AI credits
     using their KZT balance. Converts KZT to credits at the configured rate.

  4. `get_org_daily_ai_spend` -- Returns total AI credits spent by an org today.

  5. `get_ai_platform_settings` -- Returns the singleton platform settings row.
*/

-- 1. Deduct AI credits after a successful API call
CREATE OR REPLACE FUNCTION deduct_ai_credits(
  p_org_id uuid,
  p_user_id uuid,
  p_request_id text,
  p_model_slug text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_request_summary text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pricing ai_model_pricing%ROWTYPE;
  v_base_cost numeric;
  v_markup_cost numeric;
  v_balance_before numeric;
  v_balance_after numeric;
  v_daily_spend numeric;
  v_daily_limit numeric;
  v_org_daily_limit numeric;
  v_settings ai_platform_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_pricing
  FROM ai_model_pricing
  WHERE model_slug = p_model_slug AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Model pricing not found: ' || p_model_slug);
  END IF;

  v_base_cost := (p_input_tokens::numeric / 1000000.0) * v_pricing.input_price_per_1m
               + (p_output_tokens::numeric / 1000000.0) * v_pricing.output_price_per_1m;
  v_markup_cost := v_base_cost * v_pricing.markup_multiplier;

  IF v_markup_cost <= 0 THEN
    v_markup_cost := 0.000001;
  END IF;

  SELECT ai_credit_balance, ai_daily_limit
  INTO v_balance_before, v_org_daily_limit
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  IF v_balance_before < v_markup_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient AI credits', 'balance', v_balance_before, 'required', v_markup_cost);
  END IF;

  SELECT * INTO v_settings FROM ai_platform_settings LIMIT 1;
  v_daily_limit := COALESCE(v_org_daily_limit, v_settings.default_daily_limit, 1000);

  SELECT COALESCE(SUM(markup_cost), 0) INTO v_daily_spend
  FROM ai_credit_transactions
  WHERE organization_id = p_org_id
    AND created_at >= date_trunc('day', now());

  IF v_daily_spend + v_markup_cost > v_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily AI spending limit exceeded', 'daily_spend', v_daily_spend, 'daily_limit', v_daily_limit);
  END IF;

  v_balance_after := v_balance_before - v_markup_cost;

  UPDATE organizations
  SET ai_credit_balance = v_balance_after
  WHERE id = p_org_id;

  INSERT INTO ai_credit_transactions (
    organization_id, user_id, request_id, model_slug,
    input_tokens, output_tokens, base_cost, markup_cost,
    balance_before, balance_after, request_summary
  ) VALUES (
    p_org_id, p_user_id, p_request_id, p_model_slug,
    p_input_tokens, p_output_tokens, v_base_cost, v_markup_cost,
    v_balance_before, v_balance_after, LEFT(p_request_summary, 200)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deducted', v_markup_cost,
    'base_cost', v_base_cost,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'input_tokens', p_input_tokens,
    'output_tokens', p_output_tokens
  );
END;
$$;

-- 2. Top up AI credits (admin operation)
CREATE OR REPLACE FUNCTION topup_ai_credits(
  p_org_id uuid,
  p_admin_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'Admin top-up'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT ai_credit_balance INTO v_balance_before
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  v_balance_after := v_balance_before + p_amount;

  UPDATE organizations
  SET ai_credit_balance = v_balance_after
  WHERE id = p_org_id;

  INSERT INTO ai_credit_transactions (
    organization_id, user_id, request_id, model_slug,
    input_tokens, output_tokens, base_cost, markup_cost,
    balance_before, balance_after, request_summary
  ) VALUES (
    p_org_id, p_admin_id,
    'topup_' || gen_random_uuid()::text,
    'topup',
    0, 0, 0, -p_amount,
    v_balance_before, v_balance_after,
    p_description
  );

  RETURN jsonb_build_object(
    'success', true,
    'credited', p_amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

-- 3. Purchase AI credits from user's KZT balance
CREATE OR REPLACE FUNCTION purchase_ai_credits(
  p_org_id uuid,
  p_user_id uuid,
  p_credit_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings ai_platform_settings%ROWTYPE;
  v_kzt_cost numeric;
  v_user_balance numeric;
  v_user_balance_after numeric;
  v_ai_balance_before numeric;
  v_ai_balance_after numeric;
BEGIN
  IF p_credit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit amount must be positive');
  END IF;

  SELECT * INTO v_settings FROM ai_platform_settings LIMIT 1;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Platform settings not configured');
  END IF;

  IF p_credit_amount < v_settings.min_topup_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum top-up is ' || v_settings.min_topup_credits || ' credits');
  END IF;

  v_kzt_cost := p_credit_amount * v_settings.credit_price_kzt;

  SELECT balance INTO v_user_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user_balance < v_kzt_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient KZT balance', 'required_kzt', v_kzt_cost, 'current_balance', v_user_balance);
  END IF;

  v_user_balance_after := v_user_balance - v_kzt_cost;
  UPDATE users SET balance = v_user_balance_after WHERE id = p_user_id;

  INSERT INTO balance_transactions (organization_id, user_id, amount, type, description, balance_before, balance_after)
  VALUES (p_org_id, p_user_id, -v_kzt_cost, 'ai_topup', 'Purchase ' || p_credit_amount || ' AI credits', v_user_balance, v_user_balance_after);

  SELECT ai_credit_balance INTO v_ai_balance_before
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  v_ai_balance_after := v_ai_balance_before + p_credit_amount;

  UPDATE organizations SET ai_credit_balance = v_ai_balance_after WHERE id = p_org_id;

  INSERT INTO ai_credit_transactions (
    organization_id, user_id, request_id, model_slug,
    input_tokens, output_tokens, base_cost, markup_cost,
    balance_before, balance_after, request_summary
  ) VALUES (
    p_org_id, p_user_id,
    'purchase_' || gen_random_uuid()::text,
    'purchase',
    0, 0, 0, -p_credit_amount,
    v_ai_balance_before, v_ai_balance_after,
    'Purchased ' || p_credit_amount || ' credits for ' || v_kzt_cost || ' KZT'
  );

  RETURN jsonb_build_object(
    'success', true,
    'credits_purchased', p_credit_amount,
    'kzt_spent', v_kzt_cost,
    'kzt_balance_after', v_user_balance_after,
    'ai_balance_after', v_ai_balance_after,
    'rate', v_settings.credit_price_kzt
  );
END;
$$;

-- 4. Get organization's daily AI spend
CREATE OR REPLACE FUNCTION get_org_daily_ai_spend(p_org_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(markup_cost), 0)
  FROM ai_credit_transactions
  WHERE organization_id = p_org_id
    AND markup_cost > 0
    AND created_at >= date_trunc('day', now());
$$;

-- 5. Get AI platform settings
CREATE OR REPLACE FUNCTION get_ai_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings ai_platform_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM ai_platform_settings LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Settings not configured');
  END IF;
  RETURN jsonb_build_object(
    'id', v_settings.id,
    'default_daily_limit', v_settings.default_daily_limit,
    'low_balance_threshold_percent', v_settings.low_balance_threshold_percent,
    'global_ai_enabled', v_settings.global_ai_enabled,
    'cache_ttl_minutes', v_settings.cache_ttl_minutes,
    'credit_price_kzt', v_settings.credit_price_kzt,
    'min_topup_credits', v_settings.min_topup_credits,
    'has_master_key', (v_settings.master_api_key IS NOT NULL AND v_settings.master_api_key <> '')
  );
END;
$$;

-- Fix balance_transactions type constraint to allow 'ai_topup'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'balance_transactions_type_check'
  ) THEN
    ALTER TABLE balance_transactions DROP CONSTRAINT balance_transactions_type_check;
  END IF;

  ALTER TABLE balance_transactions ADD CONSTRAINT balance_transactions_type_check
    CHECK (type IN ('credit', 'debit', 'topup', 'plan_purchase', 'module_purchase', 'user_purchase', 'ai_topup'));
EXCEPTION
  WHEN others THEN NULL;
END $$;
