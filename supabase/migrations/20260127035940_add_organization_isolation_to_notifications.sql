/*
  # Add Organization Isolation to Notifications

  1. Schema Changes
    - Add `organization_id` column to notifications table
    - Add foreign key constraint to organizations
    - Add index for performance
    - Populate organization_id for existing notifications based on user's organization

  2. Security Changes
    - Drop existing public RLS policies
    - Update RLS policies to filter by organization_id
    - Ensure notifications are isolated per organization
*/

-- Add organization_id column to notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate organization_id for existing notifications based on user's organization
UPDATE notifications n
SET organization_id = u.organization_id
FROM users u
WHERE n.user_id = u.id
  AND n.organization_id IS NULL;

-- Make organization_id NOT NULL after populating
ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_organization ON notifications(user_id, organization_id);

-- Drop existing public RLS policies that allow cross-organization access
DROP POLICY IF EXISTS "Public read notifications" ON notifications;
DROP POLICY IF EXISTS "Public insert notifications" ON notifications;
DROP POLICY IF EXISTS "Public update notifications" ON notifications;
DROP POLICY IF EXISTS "Public delete notifications" ON notifications;

-- Drop existing overly permissive insert policy
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;

-- Keep existing user-specific policies (they're fine)
-- These already exist:
-- - "Users can view own notifications"
-- - "Users can update own notifications"
-- - "Users can delete own notifications"

-- Add organization-scoped insert policy
-- Notifications can only be created for users within the same organization
CREATE POLICY "Users can insert notifications for same organization"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Add additional view policy for organization managers/admins
CREATE POLICY "Organization members can view org notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
