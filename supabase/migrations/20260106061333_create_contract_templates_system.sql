/*
  # Contract Templates System

  1. New Tables
    - `contract_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name
      - `description` (text) - Template description
      - `category` (text) - service_agreement, retainer, nda, act, invoice, other
      - `file_url` (text) - URL in Supabase Storage
      - `original_filename` (text) - Original .docx filename
      - `placeholders` (jsonb) - Structured list of fields
        - simple: [{key, label, type, group, required, default, autoFillFrom}]
        - loops: [{key, label, fields[], autoFillFrom}]
      - `format_detected` (text) - Detected placeholder format: '{{}}', '{}', '[]'
      - `is_system` (boolean) - System template (cannot be deleted)
      - `author_id` (uuid, FK to users)
      - `usage_count` (integer) - Number of times used
      - `last_used_at` (timestamptz) - Last usage timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `contract_instances`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to contract_templates)
      - `client_id` (uuid, FK to clients)
      - `contract_number` (text) - Auto-generated contract number
      - `filled_data` (jsonb) - All filled values
      - `file_url` (text) - Generated document URL
      - `status` (text) - draft, generated, sent, signed
      - `created_by` (uuid, FK to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `signed_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can view all templates
    - Only authors and admins can modify templates
    - Users can view all contract instances
    - Users can create and modify their own instances
*/

-- Create contract_templates table
CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  original_filename text NOT NULL,
  placeholders jsonb DEFAULT '{"simple":[],"loops":[]}'::jsonb,
  format_detected text DEFAULT '{{}}',
  is_system boolean DEFAULT false,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contract_instances table
CREATE TABLE IF NOT EXISTS contract_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES contract_templates(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  contract_number text NOT NULL,
  filled_data jsonb DEFAULT '{}'::jsonb,
  file_url text,
  status text DEFAULT 'draft',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  signed_at timestamptz
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_category ON contract_templates(category);
CREATE INDEX IF NOT EXISTS idx_contract_templates_author ON contract_templates(author_id);
CREATE INDEX IF NOT EXISTS idx_contract_instances_template ON contract_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_contract_instances_client ON contract_instances(client_id);
CREATE INDEX IF NOT EXISTS idx_contract_instances_status ON contract_instances(status);
CREATE INDEX IF NOT EXISTS idx_contract_instances_created_by ON contract_instances(created_by);

-- Enable RLS
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_templates

-- Authenticated users can view all templates
CREATE POLICY "Users can view all templates"
  ON contract_templates FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create templates
CREATE POLICY "Users can create templates"
  ON contract_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Authors can update their own templates, system templates cannot be updated by anyone
CREATE POLICY "Authors can update own templates"
  ON contract_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id AND is_system = false)
  WITH CHECK (auth.uid() = author_id AND is_system = false);

-- Authors can delete their own templates, system templates cannot be deleted
CREATE POLICY "Authors can delete own templates"
  ON contract_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id AND is_system = false);

-- RLS Policies for contract_instances

-- Authenticated users can view all contract instances
CREATE POLICY "Users can view all instances"
  ON contract_instances FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create instances
CREATE POLICY "Users can create instances"
  ON contract_instances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own instances
CREATE POLICY "Users can update own instances"
  ON contract_instances FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own instances
CREATE POLICY "Users can delete own instances"
  ON contract_instances FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contract_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON contract_templates;
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_updated_at();

DROP TRIGGER IF EXISTS update_contract_instances_updated_at ON contract_instances;
CREATE TRIGGER update_contract_instances_updated_at
  BEFORE UPDATE ON contract_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_updated_at();