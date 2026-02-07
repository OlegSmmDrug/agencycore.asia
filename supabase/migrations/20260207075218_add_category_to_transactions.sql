/*
  # Add category column to transactions table

  1. Modified Tables
    - `transactions`
      - Added `category` (text, nullable) - categorizes transactions for P&L reporting
        Values: 'Income', 'Salary', 'Marketing', 'Office', 'Other'

  2. Data Backfill
    - Positive amounts -> 'Income'
    - Negative amounts -> 'Other' (default for expenses)
    - Known salary-related descriptions -> 'Salary'

  3. Important Notes
    - This column enables proper P&L expense breakdown in the Finance analytics tab
    - Without this column, all expense categories showed as 0%
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'category'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category text;
  END IF;
END $$;

UPDATE transactions
SET category = CASE
  WHEN amount > 0 THEN 'Income'
  WHEN amount < 0 AND (
    lower(description) LIKE '%зарплат%' OR
    lower(description) LIKE '%salary%' OR
    lower(description) LIKE '%оклад%' OR
    lower(description) LIKE '%фот%' OR
    lower(description) LIKE '%премиал%' OR
    lower(description) LIKE '%аванс%'
  ) THEN 'Salary'
  WHEN amount < 0 AND (
    lower(description) LIKE '%реклам%' OR
    lower(description) LIKE '%маркетинг%' OR
    lower(description) LIKE '%таргет%' OR
    lower(description) LIKE '%продвижен%'
  ) THEN 'Marketing'
  WHEN amount < 0 AND (
    lower(description) LIKE '%аренд%' OR
    lower(description) LIKE '%офис%' OR
    lower(description) LIKE '%коммунал%'
  ) THEN 'Office'
  WHEN amount < 0 THEN 'Other'
  ELSE 'Income'
END
WHERE category IS NULL;
