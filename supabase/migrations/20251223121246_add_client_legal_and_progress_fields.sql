/*
  # Add Legal Details and Progress System to Clients

  1. New Columns for Clients Table
    - `progress_level` (integer) - Deal progress level (0-3)
    - `contract_number` (text) - Auto-generated contract number
    - `contract_status` (text) - Contract status (draft, ready, signed)
    - `calculator_data` (jsonb) - Structured calculator results
    - `bank_name` (text) - Bank name for legal details
    - `bank_bik` (text) - Bank BIK code
    - `account_number` (text) - Account number (IIK)
    - `signatory_basis` (text) - Basis of authority (Ustav, etc.)

  2. Notes
    - progress_level: 0=New Lead, 1=Contact/Presentation, 2=Contract, 3=In Work
    - contract_status: draft, ready, signed
    - These fields support the enhanced deal card functionality
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'progress_level'
  ) THEN
    ALTER TABLE clients ADD COLUMN progress_level INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'contract_number'
  ) THEN
    ALTER TABLE clients ADD COLUMN contract_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'contract_status'
  ) THEN
    ALTER TABLE clients ADD COLUMN contract_status TEXT DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'calculator_data'
  ) THEN
    ALTER TABLE clients ADD COLUMN calculator_data JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE clients ADD COLUMN bank_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'bank_bik'
  ) THEN
    ALTER TABLE clients ADD COLUMN bank_bik TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE clients ADD COLUMN account_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'signatory_basis'
  ) THEN
    ALTER TABLE clients ADD COLUMN signatory_basis TEXT DEFAULT 'Устава';
  END IF;
END $$;

COMMENT ON COLUMN clients.progress_level IS 'Deal progress: 0=New, 1=Contact, 2=Contract, 3=Active';
COMMENT ON COLUMN clients.contract_status IS 'Contract status: draft, ready, signed';
COMMENT ON COLUMN clients.calculator_data IS 'JSON structure with calculator breakdown';
