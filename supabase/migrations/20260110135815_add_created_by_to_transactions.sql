/*
  # Add created_by field to transactions

  1. Changes
    - Add created_by column to transactions table
    - References users table
    - Nullable to support existing records

  2. Purpose
    - Track which user/manager created the transaction
    - Enable filtering by manager in Transaction Journal
*/

-- Add created_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE transactions ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
END $$;