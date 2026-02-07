/*
  # Add tax rate to company settings

  1. Modified Tables
    - `company_settings`
      - `tax_rate` (numeric) - Organization's default tax rate for financial model (e.g., 0.15 for 15%)

  2. Notes
    - Defaults to 0.15 (15% standard rate)
    - Persists across sessions so users don't have to re-select each time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN tax_rate numeric DEFAULT 0.15;
  END IF;
END $$;
