/*
  # Create Plan-Module Inclusion System

  1. New Tables
    - `plan_included_modules` - Junction table linking subscription plans to their included modules
      - `id` (uuid, primary key)
      - `plan_name` (text) - Plan name in UPPERCASE matching subscription_plans.name (e.g. 'FREE', 'STARTER')
      - `module_slug` (text) - Module slug matching platform_modules.slug
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on plan_included_modules
    - Public read access for active modules lookup

  3. Function Updates
    - Updated `get_organization_module_access` to check plan_included_modules table
      instead of hardcoded Professional/Enterprise check

  4. Seed Data
    - FREE plan: projects, clients, team (3 basic modules)
    - STARTER plan: projects, clients, team, whatsapp, content, finances, knowledge_base (7 modules)
    - PROFESSIONAL plan: all 12 modules
    - ENTERPRISE plan: all 12 modules

  5. Important Notes
    - plan_name uses UPPERCASE to match subscription_plans.name column
    - The get_organization_module_access function now converts the incoming Title Case
      plan name to UPPERCASE for lookup
    - Existing module unlock logic (organization_modules) still works alongside plan inclusions
*/

CREATE TABLE IF NOT EXISTS plan_included_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  module_slug text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_name, module_slug)
);

CREATE INDEX IF NOT EXISTS idx_plan_included_modules_plan ON plan_included_modules(plan_name);
CREATE INDEX IF NOT EXISTS idx_plan_included_modules_slug ON plan_included_modules(module_slug);

ALTER TABLE plan_included_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan module inclusions"
  ON plan_included_modules FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO plan_included_modules (plan_name, module_slug) VALUES
  ('FREE', 'projects'),
  ('FREE', 'clients'),
  ('FREE', 'team'),

  ('STARTER', 'projects'),
  ('STARTER', 'clients'),
  ('STARTER', 'team'),
  ('STARTER', 'whatsapp'),
  ('STARTER', 'content'),
  ('STARTER', 'finances'),
  ('STARTER', 'knowledge_base'),

  ('PROFESSIONAL', 'projects'),
  ('PROFESSIONAL', 'clients'),
  ('PROFESSIONAL', 'team'),
  ('PROFESSIONAL', 'whatsapp'),
  ('PROFESSIONAL', 'content'),
  ('PROFESSIONAL', 'finances'),
  ('PROFESSIONAL', 'knowledge_base'),
  ('PROFESSIONAL', 'contracts'),
  ('PROFESSIONAL', 'payroll'),
  ('PROFESSIONAL', 'analytics'),
  ('PROFESSIONAL', 'ads'),
  ('PROFESSIONAL', 'ai_agents'),

  ('ENTERPRISE', 'projects'),
  ('ENTERPRISE', 'clients'),
  ('ENTERPRISE', 'team'),
  ('ENTERPRISE', 'whatsapp'),
  ('ENTERPRISE', 'content'),
  ('ENTERPRISE', 'finances'),
  ('ENTERPRISE', 'knowledge_base'),
  ('ENTERPRISE', 'contracts'),
  ('ENTERPRISE', 'payroll'),
  ('ENTERPRISE', 'analytics'),
  ('ENTERPRISE', 'ads'),
  ('ENTERPRISE', 'ai_agents')
ON CONFLICT (plan_name, module_slug) DO NOTHING;

CREATE OR REPLACE FUNCTION get_organization_module_access(org_id uuid, plan text)
RETURNS TABLE (
  module_slug text,
  module_name text,
  module_description text,
  module_icon text,
  is_available boolean,
  is_unlocked boolean,
  requires_unlock boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  upper_plan text;
BEGIN
  upper_plan := UPPER(COALESCE(plan, 'FREE'));

  RETURN QUERY
  SELECT
    pm.slug,
    pm.name,
    pm.description,
    pm.icon,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM plan_included_modules pim
        WHERE pim.plan_name = upper_plan AND pim.module_slug = pm.slug
      ) THEN true
      WHEN om.is_unlocked = true THEN true
      ELSE false
    END as is_available,
    COALESCE(om.is_unlocked, false) as is_unlocked,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM plan_included_modules pim
        WHERE pim.plan_name = upper_plan AND pim.module_slug = pm.slug
      ) THEN false
      ELSE true
    END as requires_unlock
  FROM platform_modules pm
  LEFT JOIN organization_modules om ON pm.slug = om.module_slug AND om.organization_id = org_id
  WHERE pm.is_active = true
  ORDER BY pm.sort_order;
END;
$$;
