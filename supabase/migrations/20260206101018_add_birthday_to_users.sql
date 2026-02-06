/*
  # Add birthday field to users table

  1. Modified Tables
    - `users`
      - `birthday` (date, nullable) - date of birth, auto-calculated from IIN

  2. Notes
    - Birthday is extracted from Kazakhstan IIN (Individual Identification Number)
    - First 6 digits of IIN encode YYMMDD, 7th digit encodes century
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'birthday'
  ) THEN
    ALTER TABLE users ADD COLUMN birthday date;
  END IF;
END $$;
