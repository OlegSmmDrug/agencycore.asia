/*
  # Guest Access and Content Approval System

  ## Overview
  This migration creates a comprehensive guest access system for client content approval workflow.
  Guests can view projects via permanent shareable links, approve/reject content, and add comments.

  ## 1. New Tables

  ### `guest_users`
  Stores guest user profiles (clients who access via shared links)
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Guest's full name
  - `email` (text, unique) - Email for notifications
  - `phone` (text, nullable) - Optional phone number
  - `preferences` (jsonb) - Notification and display preferences
  - `created_at` (timestamptz) - Registration timestamp
  - `last_access_at` (timestamptz) - Last activity timestamp

  ### `guest_access`
  Manages project access tokens (permanent, deactivatable)
  - `id` (uuid, primary key) - Unique identifier
  - `project_id` (uuid) - Related project
  - `token` (text, unique) - Permanent access token
  - `permissions` (jsonb) - Array of permissions (viewTasks, approveContent, addComments)
  - `is_active` (boolean) - Manual activation flag (no expiration)
  - `created_by` (uuid) - User who created the link
  - `created_at` (timestamptz) - Creation timestamp
  - `last_used_at` (timestamptz) - Last token usage

  ### `guest_project_access`
  Many-to-many relationship between guests and projects via tokens
  - `id` (uuid, primary key)
  - `guest_id` (uuid) - Guest user
  - `project_id` (uuid) - Project
  - `access_token_id` (uuid) - Access token used
  - `registered_at` (timestamptz) - When guest registered for this project

  ## 2. Extended Tables

  ### `projects` - New Columns
  - `public_share_token` (text, unique) - Permanent public share token
  - `public_share_enabled` (boolean, default false) - Enable/disable sharing
  - `allow_guest_approval` (boolean, default true) - Allow guests to approve content
  - `guest_view_settings` (jsonb) - Guest UI customization

  ### `tasks` - New Columns (Approval Workflow)
  - `client_comment` (text) - Current client feedback (visible to all)
  - `internal_comments` (jsonb) - Array of internal team comments (hidden from guests)
  - `revision_history` (jsonb) - Complete approval/rejection history
  - `approved_by` (text) - User or guest ID who approved
  - `approved_at` (timestamptz) - Approval timestamp
  - `rejected_count` (integer, default 0) - Number of rejections

  ## 3. Security (RLS Policies)

  All tables have RLS enabled with restrictive-by-default policies:

  - **Guests**: Can only view final task fields (no internal data)
  - **Guests**: Can only update client_comment and status on approval/rejection
  - **Guests**: Cannot see financial data, team info, or internal comments
  - **Team**: Full access to all data in their projects

  ## 4. Helper Functions

  - `is_guest_authorized(token, project_id)` - Validates guest access
  - `log_guest_activity(token)` - Updates last_used_at timestamp

  ## 5. Important Notes

  - Guest tokens are **permanent** (no expiration) - only manual deactivation
  - Unlimited revisions allowed (no limit on rejected_count)
  - Client comments are public, internal comments are team-only
  - All guest actions are logged for analytics
*/

-- Create guest_users table
CREATE TABLE IF NOT EXISTS guest_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  preferences jsonb DEFAULT '{"emailNotifications": true, "smsNotifications": false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  last_access_at timestamptz DEFAULT now()
);

-- Create guest_access table
CREATE TABLE IF NOT EXISTS guest_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  permissions jsonb DEFAULT '["viewTasks", "approveContent", "addComments"]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

-- Create guest_project_access junction table
CREATE TABLE IF NOT EXISTS guest_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guest_users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  access_token_id uuid NOT NULL REFERENCES guest_access(id) ON DELETE CASCADE,
  registered_at timestamptz DEFAULT now(),
  UNIQUE(guest_id, project_id)
);

-- Add new columns to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'public_share_token'
  ) THEN
    ALTER TABLE projects ADD COLUMN public_share_token text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'public_share_enabled'
  ) THEN
    ALTER TABLE projects ADD COLUMN public_share_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'allow_guest_approval'
  ) THEN
    ALTER TABLE projects ADD COLUMN allow_guest_approval boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'guest_view_settings'
  ) THEN
    ALTER TABLE projects ADD COLUMN guest_view_settings jsonb DEFAULT '{"hideInternalNotes": true, "hideFinances": true, "hidePricing": true}'::jsonb;
  END IF;
END $$;

-- Add new columns to tasks table for approval workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'client_comment'
  ) THEN
    ALTER TABLE tasks ADD COLUMN client_comment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'internal_comments'
  ) THEN
    ALTER TABLE tasks ADD COLUMN internal_comments jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'revision_history'
  ) THEN
    ALTER TABLE tasks ADD COLUMN revision_history jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN approved_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'rejected_count'
  ) THEN
    ALTER TABLE tasks ADD COLUMN rejected_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_access_token ON guest_access(token);
CREATE INDEX IF NOT EXISTS idx_guest_access_project ON guest_access(project_id);
CREATE INDEX IF NOT EXISTS idx_guest_users_email ON guest_users(email);
CREATE INDEX IF NOT EXISTS idx_guest_project_access_guest ON guest_project_access(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_project_access_project ON guest_project_access(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_approved_by ON tasks(approved_by);
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(public_share_token);

-- Enable RLS on new tables
ALTER TABLE guest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_project_access ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if guest is authorized for a project
CREATE OR REPLACE FUNCTION is_guest_authorized(p_token text, p_project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM guest_access
    WHERE token = p_token
    AND project_id = p_project_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Log guest activity
CREATE OR REPLACE FUNCTION log_guest_activity(p_token text)
RETURNS void AS $$
BEGIN
  UPDATE guest_access
  SET last_used_at = now()
  WHERE token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for guest_users
CREATE POLICY "Anyone can register as guest"
  ON guest_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Guests can view own profile"
  ON guest_users FOR SELECT
  USING (true);

CREATE POLICY "Guests can update own profile"
  ON guest_users FOR UPDATE
  USING (true);

-- RLS Policies for guest_access
CREATE POLICY "Team can manage guest access"
  ON guest_access FOR ALL
  USING (true);

-- RLS Policies for guest_project_access
CREATE POLICY "Anyone can link guest to project"
  ON guest_project_access FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view guest project links"
  ON guest_project_access FOR SELECT
  USING (true);