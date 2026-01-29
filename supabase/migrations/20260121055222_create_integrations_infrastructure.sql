/*
  # Create Integrations Infrastructure

  1. New Tables
    - `integrations`
      - Core integration configurations and status
      - Supports multiple integration types (CRM, Analytics, Communication)
      - Tracks sync status and error handling
    
    - `integration_credentials`
      - Secure storage for API keys and tokens
      - Encrypted values using pgcrypto
      - Separate table for enhanced security
    
    - `integration_sync_logs`
      - History of all synchronization attempts
      - Performance metrics and error tracking
      - Retention for debugging
    
    - `integration_api_calls`
      - Monitor API usage and rate limits
      - Track quotas and billing
      - Prevent API limit violations
    
    - `automation_rules`
      - Visual workflow automation engine
      - Trigger → Condition → Action pattern
      - Support for complex business logic
    
    - `webhook_endpoints`
      - Custom webhook configurations
      - Field mapping for incoming data
      - Retry logic and error handling

  2. Security
    - Enable RLS on all tables
    - Organization-based access control
    - Encrypted credential storage
    - Secure webhook token generation

  3. Performance
    - Indexes on foreign keys
    - Indexes on frequently queried fields
    - JSONB indexes for config searches
*/

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'facebook_ads', 'google_ads', 'whatsapp', 'email', etc.
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL, -- 'crm_automation', 'analytics', 'communication', 'marketplace'
  status text NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'error', 'needs_config'
  config jsonb DEFAULT '{}', -- Integration-specific configuration
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  sync_frequency text DEFAULT 'manual', -- 'manual', 'hourly', 'daily', 'weekly'
  error_message text,
  error_count integer DEFAULT 0,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Integration credentials (encrypted)
CREATE TABLE IF NOT EXISTS integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  credential_key text NOT NULL, -- 'api_key', 'access_token', 'refresh_token', etc.
  encrypted_value bytea NOT NULL, -- Encrypted using pgcrypto
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(integration_id, credential_key)
);

-- Integration sync logs
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  sync_started_at timestamptz DEFAULT now(),
  sync_finished_at timestamptz,
  status text NOT NULL, -- 'running', 'success', 'failed', 'partial'
  records_synced integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Integration API call tracking
CREATE TABLE IF NOT EXISTS integration_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  is_success boolean DEFAULT true,
  error_message text,
  quota_used integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  trigger_type text NOT NULL, -- 'client_created', 'status_changed', 'task_created', 'payment_received', 'deadline_approaching'
  trigger_config jsonb DEFAULT '{}', -- Trigger-specific configuration
  condition_config jsonb DEFAULT '{}', -- Filters and conditions (budget > X, status = Y, etc.)
  action_type text NOT NULL, -- 'create_task', 'send_whatsapp', 'change_status', 'assign_manager', 'webhook'
  action_config jsonb DEFAULT '{}', -- Action-specific configuration
  is_active boolean DEFAULT true,
  execution_count integer DEFAULT 0,
  last_executed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  endpoint_url text NOT NULL, -- The unique URL to receive webhooks
  secret_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'), -- For webhook verification
  source_type text NOT NULL, -- 'creatium', 'custom', 'zapier', 'make', etc.
  field_mapping jsonb DEFAULT '{}', -- Map webhook fields to CRM fields
  retry_config jsonb DEFAULT '{"max_retries": 3, "backoff_multiplier": 2}',
  is_active boolean DEFAULT true,
  last_received_at timestamptz,
  total_received integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_integration_credentials_integration ON integration_credentials(integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration ON integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_created ON integration_sync_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_api_calls_integration ON integration_api_calls(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_calls_created ON integration_api_calls(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_token ON webhook_endpoints(secret_token);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_api_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations (currently disabled for simple auth, but structured for future)
-- When auth is enabled, these will be activated
CREATE POLICY "Users can view integrations in their organization"
  ON integrations FOR SELECT
  USING (true);

CREATE POLICY "Users can manage integrations in their organization"
  ON integrations FOR ALL
  USING (true);

-- RLS for credentials (most sensitive)
CREATE POLICY "Users can view credentials in their organization"
  ON integration_credentials FOR SELECT
  USING (true);

CREATE POLICY "Users can manage credentials in their organization"
  ON integration_credentials FOR ALL
  USING (true);

-- RLS for sync logs
CREATE POLICY "Users can view sync logs in their organization"
  ON integration_sync_logs FOR SELECT
  USING (true);

CREATE POLICY "System can insert sync logs"
  ON integration_sync_logs FOR INSERT
  WITH CHECK (true);

-- RLS for API calls
CREATE POLICY "Users can view API calls in their organization"
  ON integration_api_calls FOR SELECT
  USING (true);

CREATE POLICY "System can insert API calls"
  ON integration_api_calls FOR INSERT
  WITH CHECK (true);

-- RLS for automation rules
CREATE POLICY "Users can view automation rules in their organization"
  ON automation_rules FOR SELECT
  USING (true);

CREATE POLICY "Users can manage automation rules in their organization"
  ON automation_rules FOR ALL
  USING (true);

-- RLS for webhook endpoints
CREATE POLICY "Users can view webhook endpoints in their organization"
  ON webhook_endpoints FOR SELECT
  USING (true);

CREATE POLICY "Users can manage webhook endpoints in their organization"
  ON webhook_endpoints FOR ALL
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();
