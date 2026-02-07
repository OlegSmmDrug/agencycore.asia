/*
  # Reclassify bank import clients and add repeat sale support

  1. Data Fix
    - Reclassify all existing clients with source='Other', budget=0, empty email/phone
      as source='Bank Import' (these were auto-created from bank statement reconciliation)
    - This cleans up the CRM pipeline from non-lead bank counterparties

  2. Schema Changes
    - Add `parent_client_id` column to `clients` table for repeat sale tracking
      (links a new deal back to the original client for upsell/cross-sell)

  3. Important Notes
    - Only affects clients matching the bank-import pattern (source='Other', budget=0, no email/phone)
    - Manually created 'Other' clients with real data are NOT affected
    - The parent_client_id enables tracking repeat sales from existing clients
*/

UPDATE clients
SET source = 'Bank Import'
WHERE source = 'Other'
  AND (budget = 0 OR budget IS NULL)
  AND (email = '' OR email IS NULL)
  AND (phone = '' OR phone IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'parent_client_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN parent_client_id uuid REFERENCES clients(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_parent_client_id ON clients(parent_client_id) WHERE parent_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source);
