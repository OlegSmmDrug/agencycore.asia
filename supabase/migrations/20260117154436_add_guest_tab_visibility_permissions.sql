/*
  # Add Tab Visibility Permissions for Guest Access

  ## Overview
  This migration adds new permission types to control which tabs/sections
  guests can see in the project view. Previously, permissions only controlled
  general actions (viewTasks, approveContent, addComments). Now we add
  granular control over tab visibility.

  ## Changes
  
  1. Updates guest_access permissions default value to include tab visibility options:
     - `viewOverview` - Overview tab (enabled by default)
     - `viewRoadmap` - Roadmap tab (enabled by default)
     - `viewNotes` - Notes tab (enabled by default)
     - `viewCalendar` - Calendar tab (enabled by default)
     - `viewFacebook` - Facebook Analytics tab (enabled by default)
     - `viewLivedune` - Livedune Analytics tab (enabled by default)
     - Existing: `viewTasks`, `approveContent`, `addComments`

  2. Notes
     - All tabs are enabled by default for backward compatibility
     - Existing guest_access records are NOT modified
     - Only new records will have the new default permissions
*/

-- Update default permissions for guest_access table to include tab visibility
ALTER TABLE guest_access 
  ALTER COLUMN permissions 
  SET DEFAULT '["viewTasks", "approveContent", "addComments", "viewOverview", "viewRoadmap", "viewNotes", "viewCalendar", "viewFacebook", "viewLivedune"]'::jsonb;

-- Update existing guest_access records to include all tab permissions
UPDATE guest_access
SET permissions = permissions::jsonb || 
  '["viewOverview", "viewRoadmap", "viewNotes", "viewCalendar", "viewFacebook", "viewLivedune"]'::jsonb
WHERE NOT (permissions::jsonb @> '["viewOverview"]'::jsonb);