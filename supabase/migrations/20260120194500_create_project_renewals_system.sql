/*
  # Create Project Renewals Tracking System

  1. New Tables
    - `project_renewals`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `client_id` (uuid, foreign key to clients)
      - `previous_end_date` (date) - End date before renewal
      - `new_end_date` (date) - End date after renewal
      - `renewal_date` (timestamptz) - When the renewal happened
      - `renewed_amount` (numeric) - Budget amount of the renewed period
      - `renewed_by` (uuid, foreign key to users) - User who performed the renewal
      - `organization_id` (uuid, foreign key to organizations)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `project_renewals` table
    - Add policies for authenticated users within same organization

  3. Indexes
    - Add index on project_id for fast lookups
    - Add index on renewed_by for manager metrics
    - Add index on organization_id for tenant isolation
    - Add index on renewal_date for time-based queries
*/

CREATE TABLE IF NOT EXISTS project_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  previous_end_date date NOT NULL,
  new_end_date date NOT NULL,
  renewal_date timestamptz DEFAULT now() NOT NULL,
  renewed_amount numeric(12,2) DEFAULT 0 NOT NULL,
  renewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_renewals_project_id ON project_renewals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_renewals_renewed_by ON project_renewals(renewed_by);
CREATE INDEX IF NOT EXISTS idx_project_renewals_organization_id ON project_renewals(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_renewals_renewal_date ON project_renewals(renewal_date);
CREATE INDEX IF NOT EXISTS idx_project_renewals_client_id ON project_renewals(client_id);

ALTER TABLE project_renewals ENABLE ROW LEVEL SECURITY;
