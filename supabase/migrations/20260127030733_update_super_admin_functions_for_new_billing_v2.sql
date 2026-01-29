/*
  # Update Super Admin Functions for New Billing Fields

  1. Changes
    - Drop existing get_organizations_list function
    - Create new version with additional billing fields
    - Add additional_users_count, subscription_period, subscription_end_date to return
    - Remove dependency on organization_subscriptions and subscription_plans tables
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_organizations_list(uuid, text, integer, integer);

-- Create new version with additional fields
CREATE OR REPLACE FUNCTION get_organizations_list(
  user_id uuid DEFAULT NULL,
  search_query text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  owner_email text,
  plan_name text,
  subscription_status text,
  mrr numeric,
  users_count integer,
  projects_count integer,
  is_blocked boolean,
  created_at timestamptz,
  additional_users_count integer,
  subscription_period text,
  subscription_end_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_id AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: super admin only';
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    owner.email as owner_email,
    o.plan_name,
    o.subscription_status,
    o.mrr,
    (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id)::integer as users_count,
    (SELECT COUNT(*) FROM projects p WHERE p.organization_id = o.id)::integer as projects_count,
    o.is_blocked,
    o.created_at,
    o.additional_users_count,
    o.subscription_period,
    o.subscription_end_date
  FROM organizations o
  LEFT JOIN users owner ON o.owner_id = owner.id
  WHERE o.is_deleted = false
    AND (search_query IS NULL OR 
         o.name ILIKE '%' || search_query || '%' OR 
         owner.email ILIKE '%' || search_query || '%')
  ORDER BY o.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;