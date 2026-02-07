/*
  # Create Resource Overrides System

  1. New Tables
    - `resource_overrides`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `users_delta` (integer) - adjustment to base user limit (negative = gave up, positive = acquired)
      - `projects_delta` (integer) - adjustment to base project limit
      - `storage_delta_gb` (integer) - adjustment to base storage limit in GB
      - `points_earned` (numeric) - total points earned from selling resources
      - `points_spent` (numeric) - total points spent on buying resources
      - `valid_until` (timestamptz) - override expiry date (end of billing period)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - RLS disabled (matches project convention for simple auth)
  
  3. Notes
    - Only one active override per organization at a time
    - Overrides auto-expire at valid_until date
    - Exchange rates: Sell - User:3.0, Project:0.8, Storage(GB):0.3 | Buy - User:7.0, Project:2.5, Storage(GB):1.0
*/

CREATE TABLE IF NOT EXISTS resource_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  users_delta integer NOT NULL DEFAULT 0,
  projects_delta integer NOT NULL DEFAULT 0,
  storage_delta_gb integer NOT NULL DEFAULT 0,
  points_earned numeric NOT NULL DEFAULT 0,
  points_spent numeric NOT NULL DEFAULT 0,
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_overrides_org_id ON resource_overrides(organization_id);
CREATE INDEX IF NOT EXISTS idx_resource_overrides_valid_until ON resource_overrides(valid_until);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resource_overrides_one_active_per_org'
  ) THEN
    ALTER TABLE resource_overrides 
      ADD CONSTRAINT resource_overrides_one_active_per_org 
      UNIQUE (organization_id);
  END IF;
END $$;
