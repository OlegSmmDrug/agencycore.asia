/*
  # Add tax rate and custom DDS rows to financial plans

  1. Modified Tables
    - `financial_plans`
      - `tax_rate` (numeric) - Organization's selected tax rate, persisted per-plan
      - `custom_dds_rows` (jsonb) - Custom expense categories added by user in DDS view
      - `dds_capex` (numeric) - Capital expenditure for DDS
      - `dds_financing` (numeric) - Financing activity for DDS (loans, dividends)

  2. Notes
    - tax_rate defaults to 0.15 (15% standard)
    - custom_dds_rows stores array of {name, amounts: {month: value}} for user-created DDS categories
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_plans' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE financial_plans ADD COLUMN tax_rate numeric DEFAULT 0.15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_plans' AND column_name = 'custom_dds_rows'
  ) THEN
    ALTER TABLE financial_plans ADD COLUMN custom_dds_rows jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_plans' AND column_name = 'dds_capex'
  ) THEN
    ALTER TABLE financial_plans ADD COLUMN dds_capex numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_plans' AND column_name = 'dds_financing'
  ) THEN
    ALTER TABLE financial_plans ADD COLUMN dds_financing numeric DEFAULT 0;
  END IF;
END $$;
