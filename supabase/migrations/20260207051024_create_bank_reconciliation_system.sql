/*
  # Bank Reconciliation System

  1. New Tables
    - `bank_counterparty_aliases`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `bank_name` (text) - raw name from bank statement
      - `bank_bin` (text) - BIN/IIN from bank statement
      - `client_id` (uuid, FK to clients) - matched client in system
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `transactions`
      - `reconciliation_status` (text) - manual/verified/discrepancy/bank_import
      - `bank_document_number` (text) - unique document number from bank
      - `bank_amount` (numeric) - original amount from bank
      - `bank_client_name` (text) - raw client name from bank
      - `bank_bin` (text) - BIN/IIN from bank statement
      - `bank_imported_at` (timestamptz) - when imported from bank
      - `linked_transaction_id` (uuid) - link to manual entry if reconciled
      - `amount_discrepancy` (boolean) - flag if amounts differ

  3. Security
    - RLS disabled (matches existing project pattern)

  4. Notes
    - reconciliation_status values: 'manual', 'verified', 'discrepancy', 'bank_import'
    - bank_counterparty_aliases stores learned mappings between bank names and system clients
    - BIN has absolute priority over text matching
*/

CREATE TABLE IF NOT EXISTS bank_counterparty_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  bank_name text NOT NULL DEFAULT '',
  bank_bin text NOT NULL DEFAULT '',
  client_id uuid REFERENCES clients(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_aliases_org_bin
  ON bank_counterparty_aliases(organization_id, bank_bin)
  WHERE bank_bin != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_aliases_org_name
  ON bank_counterparty_aliases(organization_id, lower(bank_name))
  WHERE bank_name != '' AND bank_bin = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'reconciliation_status'
  ) THEN
    ALTER TABLE transactions ADD COLUMN reconciliation_status text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bank_document_number'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bank_document_number text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bank_amount'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bank_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bank_client_name'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bank_client_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bank_bin'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bank_bin text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'bank_imported_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN bank_imported_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'linked_transaction_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN linked_transaction_id uuid REFERENCES transactions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'amount_discrepancy'
  ) THEN
    ALTER TABLE transactions ADD COLUMN amount_discrepancy boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation_status
  ON transactions(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_transactions_bank_document_number
  ON transactions(bank_document_number)
  WHERE bank_document_number != '';

CREATE INDEX IF NOT EXISTS idx_transactions_bank_bin
  ON transactions(bank_bin)
  WHERE bank_bin != '';
