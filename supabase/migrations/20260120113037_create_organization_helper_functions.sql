/*
  # Create Organization Helper Functions

  ## Overview
  These functions help with organization context and access control in RLS policies.

  ## Functions Created
  1. get_current_user_organization_id() - Gets organization_id for current user
  2. is_super_admin() - Checks if current user is super admin
  3. has_organization_access(org_id) - Checks if user has access to organization
  4. get_organization_subscription(org_id) - Gets subscription details
  5. check_feature_access(org_id, feature_name) - Checks if organization has access to feature
  6. check_usage_limit(org_id, metric_type) - Checks if organization is within usage limits
*/

-- Function to get current user's organization_id
-- This will be used in RLS policies
CREATE OR REPLACE FUNCTION get_current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Try to get organization_id from users table
  -- In future, this will read from JWT claims or user_profiles (after Supabase Auth migration)
  SELECT organization_id INTO org_id
  FROM users
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$;

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Check if user has SUPER_ADMIN role
  -- In future, this will also check JWT claims
  SELECT system_role INTO user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_role = 'Admin'; -- For now, Admin = super admin
END;
$$;

-- Function to check if user has access to specific organization
CREATE OR REPLACE FUNCTION has_organization_access(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_org_id uuid;
  is_admin boolean;
BEGIN
  -- Super admins have access to everything
  is_admin := is_super_admin();
  IF is_admin THEN
    RETURN true;
  END IF;

  -- Check if user belongs to this organization
  user_org_id := get_current_user_organization_id();
  RETURN user_org_id = org_id;
END;
$$;

-- Function to get organization subscription details
CREATE OR REPLACE FUNCTION get_organization_subscription(org_id uuid)
RETURNS TABLE (
  plan_name text,
  status text,
  features jsonb,
  max_users integer,
  max_projects integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.name as plan_name,
    os.status,
    sp.features,
    sp.max_users,
    sp.max_projects
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON os.plan_id = sp.id
  WHERE os.organization_id = org_id
  AND os.status IN ('trial', 'active')
  LIMIT 1;
END;
$$;

-- Function to check feature access for organization
CREATE OR REPLACE FUNCTION check_feature_access(org_id uuid, feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  has_feature boolean;
BEGIN
  SELECT 
    COALESCE((sp.features->feature_name)::boolean, false) INTO has_feature
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON os.plan_id = sp.id
  WHERE os.organization_id = org_id
  AND os.status IN ('trial', 'active')
  LIMIT 1;
  
  RETURN COALESCE(has_feature, false);
END;
$$;

-- Function to check if organization is within usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(org_id uuid, metric_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  current_val integer;
  limit_val integer;
BEGIN
  SELECT 
    um.current_value,
    um.limit_value
  INTO current_val, limit_val
  FROM usage_metrics um
  WHERE um.organization_id = org_id
  AND um.metric_type = metric_type
  LIMIT 1;
  
  -- If no limit set (NULL), return true (unlimited)
  IF limit_val IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if within limit
  RETURN COALESCE(current_val, 0) < limit_val;
END;
$$;

-- Function to increment usage metric
CREATE OR REPLACE FUNCTION increment_usage_metric(org_id uuid, metric_type text, increment_by integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO usage_metrics (organization_id, metric_type, current_value, updated_at)
  VALUES (org_id, metric_type, increment_by, now())
  ON CONFLICT (organization_id, metric_type)
  DO UPDATE SET
    current_value = usage_metrics.current_value + increment_by,
    updated_at = now();
END;
$$;

-- Function to reset usage metric (for new period)
CREATE OR REPLACE FUNCTION reset_usage_metric(org_id uuid, metric_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE usage_metrics
  SET 
    current_value = 0,
    period_start = now(),
    period_end = now() + interval '1 month',
    updated_at = now()
  WHERE organization_id = org_id
  AND metric_type = metric_type;
END;
$$;

-- Function to check if organization is blocked
CREATE OR REPLACE FUNCTION is_organization_blocked(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  blocked boolean;
BEGIN
  SELECT is_blocked INTO blocked
  FROM organizations
  WHERE id = org_id;
  
  RETURN COALESCE(blocked, false);
END;
$$;

-- Function to check if subscription is active
CREATE OR REPLACE FUNCTION is_subscription_active(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  sub_status text;
BEGIN
  SELECT status INTO sub_status
  FROM organization_subscriptions
  WHERE organization_id = org_id
  LIMIT 1;
  
  RETURN sub_status IN ('trial', 'active');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_user_organization_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION has_organization_access(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_organization_subscription(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_feature_access(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_usage_limit(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_usage_metric(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_usage_metric(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_blocked(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_subscription_active(uuid) TO authenticated, anon;
