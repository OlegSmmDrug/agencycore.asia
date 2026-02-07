/*
  # Create financial_plans table for Plan vs Fact reporting

  1. New Tables
    - `financial_plans`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `month` (text, YYYY-MM format) - the planning period
      - `planned_revenue` (numeric) - target revenue for the month
      - `planned_net_profit` (numeric) - target net profit
      - `planned_ebitda` (numeric) - target EBITDA
      - `planned_expenses` (numeric) - target total expenses
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS disabled (matches project pattern for simple auth)

  3. Indexes
    - Unique constraint on (organization_id, month)

  4. Important Notes
    - Replaces hardcoded plan calculations in the Finance P&L tab
    - Users can set monthly financial targets that are compared against actuals
*/

CREATE TABLE IF NOT EXISTS financial_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  month text NOT NULL,
  planned_revenue numeric DEFAULT 0,
  planned_net_profit numeric DEFAULT 0,
  planned_ebitda numeric DEFAULT 0,
  planned_expenses numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_plans_org_month
  ON financial_plans(organization_id, month);

ALTER TABLE financial_plans ENABLE ROW LEVEL SECURITY;
