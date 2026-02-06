/*
  # Add storage limits per plan

  1. Modified Tables
    - `subscription_plans`
      - Added `max_storage_mb` (integer, nullable) - storage limit in megabytes per organization
        - FREE: 500 MB
        - STARTER: 5120 MB (5 GB)
        - PROFESSIONAL: 10240 MB (10 GB)
        - ENTERPRISE: NULL (unlimited)

  2. New Functions
    - `get_organization_storage_usage_mb(org_id uuid)` - calculates total storage used by an organization across all buckets
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'max_storage_mb'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN max_storage_mb integer DEFAULT NULL;
  END IF;
END $$;

UPDATE subscription_plans SET max_storage_mb = 500 WHERE name = 'FREE';
UPDATE subscription_plans SET max_storage_mb = 5120 WHERE name = 'STARTER';
UPDATE subscription_plans SET max_storage_mb = 10240 WHERE name = 'PROFESSIONAL';
UPDATE subscription_plans SET max_storage_mb = NULL WHERE name = 'ENTERPRISE';

CREATE OR REPLACE FUNCTION get_organization_storage_usage_mb(org_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bytes bigint;
BEGIN
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  INTO total_bytes
  FROM storage.objects
  WHERE name LIKE org_id::text || '/%';

  RETURN ROUND(total_bytes / 1048576.0, 2);
END;
$$;
