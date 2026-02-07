/*
  # Extend financial_plans with detailed P&L row fields

  1. Modified Tables
    - `financial_plans`
      - `planned_cogs` (numeric) - planned cost of goods sold
      - `planned_marketing` (numeric) - planned marketing & sales expenses
      - `planned_payroll` (numeric) - planned payroll (FOT)
      - `planned_office` (numeric) - planned office & software expenses
      - `planned_other_opex` (numeric) - other professional/operating expenses
      - `planned_taxes` (numeric) - planned tax expenses
      - `planned_depreciation` (numeric) - planned depreciation/amortization
      - `is_editable` (boolean) - whether user has manually edited this month
      - `notes` (text) - user notes for the month

  2. Important Notes
    - These columns allow the Financial Model to store per-line-item plans for each month
    - Header rows (ДОХОД, ОПЕРАЦИОННЫЕ РАСХОДЫ, etc.) will now compute as sums of their children
    - EBITDA, taxes, and net profit are calculated from these values
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_cogs') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_cogs numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_marketing') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_marketing numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_payroll') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_payroll numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_office') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_office numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_other_opex') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_other_opex numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_taxes') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_taxes numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'planned_depreciation') THEN
    ALTER TABLE financial_plans ADD COLUMN planned_depreciation numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'is_editable') THEN
    ALTER TABLE financial_plans ADD COLUMN is_editable boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_plans' AND column_name = 'notes') THEN
    ALTER TABLE financial_plans ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;
