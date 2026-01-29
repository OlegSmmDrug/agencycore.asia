/*
  # Add Project Overview Fields

  1. New Columns for `projects` table:
    - `kpis` (jsonb) - Array of KPI objects with name, plan, fact values
    - `quick_links` (jsonb) - Array of link objects with name, url, icon
    - `focus_week` (text) - Current week focus text
    - `risks` (jsonb) - Array of risk objects
    - `work_scope` (text) - Work scope description
    - `health_status` (text) - Project health: 'excellent', 'good', 'warning', 'critical'
    - `contract_number` (text) - Contract number
    - `contract_date` (date) - Contract signing date
    - `contract_scan_url` (text) - URL to contract scan document

  2. Purpose:
    - Enable comprehensive project overview dashboard
    - Track KPIs with plan/fact metrics
    - Store quick access links
    - Monitor project health and risks
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'kpis'
  ) THEN
    ALTER TABLE projects ADD COLUMN kpis jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'quick_links'
  ) THEN
    ALTER TABLE projects ADD COLUMN quick_links jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'focus_week'
  ) THEN
    ALTER TABLE projects ADD COLUMN focus_week text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'risks'
  ) THEN
    ALTER TABLE projects ADD COLUMN risks jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'work_scope'
  ) THEN
    ALTER TABLE projects ADD COLUMN work_scope text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'health_status'
  ) THEN
    ALTER TABLE projects ADD COLUMN health_status text DEFAULT 'good';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contract_number'
  ) THEN
    ALTER TABLE projects ADD COLUMN contract_number text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contract_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN contract_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contract_scan_url'
  ) THEN
    ALTER TABLE projects ADD COLUMN contract_scan_url text DEFAULT '';
  END IF;
END $$;
