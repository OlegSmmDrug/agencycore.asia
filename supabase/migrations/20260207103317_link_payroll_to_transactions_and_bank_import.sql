/*
  # Link Payroll System to Transactions and Bank Import

  1. Modified Tables
    - `transactions`
      - `user_id` (uuid, nullable, FK to users) - links salary transactions to employees
      - `payroll_record_id` (uuid, nullable, FK to payroll_records) - links to specific payroll record
    - `users`
      - `employment_type` (text) - employment category for tax calculation (staff/ip/sz/nal)
    - `payroll_records`
      - `net_amount` (numeric) - after-tax amount actually paid to employee

  2. Indexes
    - Index on transactions.user_id for fast employee transaction lookups
    - Index on transactions.payroll_record_id for payroll reconciliation
    - Index on transactions.category for salary filtering
    - Index on users.iin for bank import matching

  3. Important Notes
    - client_id is already nullable, no changes needed
    - organization_id already exists on transactions for direct filtering
    - These changes enable: payroll -> transaction -> bank reconciliation pipeline
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'payroll_record_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN payroll_record_id uuid REFERENCES payroll_records(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'employment_type'
  ) THEN
    ALTER TABLE users ADD COLUMN employment_type text DEFAULT 'staff';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN net_amount numeric DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payroll_record_id ON transactions(payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_users_iin ON users(iin) WHERE iin IS NOT NULL AND iin != '';
