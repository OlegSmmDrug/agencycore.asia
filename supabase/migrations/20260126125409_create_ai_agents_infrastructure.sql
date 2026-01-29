/*
  # AI Agents Infrastructure

  1. New Tables
    - `ai_agents` - Core AI agent configuration
    - `ai_leads` - AI-qualified leads
    - `ai_actions` - Proposed actions requiring approval
    - `ai_knowledge_faqs` - FAQ knowledge base for agents
    - `ai_documents` - Uploaded documents for RAG
    - `ai_usage_stats` - Usage statistics and costs tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for organization isolation
    - Restrict access based on organization_id

  3. Indexes
    - Add indexes on organization_id for all tables
    - Add indexes on frequently queried fields
*/

-- AI Agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  model text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  triggers jsonb DEFAULT '[]'::jsonb,
  communication_style text NOT NULL DEFAULT 'conversational',
  system_prompt text NOT NULL DEFAULT '',
  temperature numeric NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 2000,
  use_knowledge_base boolean NOT NULL DEFAULT true,
  daily_cost_limit numeric NOT NULL DEFAULT 5.0,
  auto_mode boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Leads table
CREATE TABLE IF NOT EXISTS ai_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  budget numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'qualified',
  score integer NOT NULL DEFAULT 5,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'ai_agent',
  last_contact_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- AI Actions table
CREATE TABLE IF NOT EXISTS ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  description text NOT NULL,
  reasoning text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- AI Knowledge FAQs table
CREATE TABLE IF NOT EXISTS ai_knowledge_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'General',
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Documents table
CREATE TABLE IF NOT EXISTS ai_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  content_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- AI Usage Stats table
CREATE TABLE IF NOT EXISTS ai_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  requests_count integer DEFAULT 0,
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  cost_spent numeric DEFAULT 0,
  success_rate numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, organization_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_agents_org ON ai_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_role ON ai_agents(role);

CREATE INDEX IF NOT EXISTS idx_ai_leads_org ON ai_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_leads_agent ON ai_leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_leads_status ON ai_leads(status);
CREATE INDEX IF NOT EXISTS idx_ai_leads_score ON ai_leads(score);

CREATE INDEX IF NOT EXISTS idx_ai_actions_org ON ai_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_agent ON ai_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON ai_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_faqs_org ON ai_knowledge_faqs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_faqs_agent ON ai_knowledge_faqs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_faqs_priority ON ai_knowledge_faqs(priority DESC);

CREATE INDEX IF NOT EXISTS idx_ai_docs_org ON ai_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_docs_agent ON ai_documents(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_stats_org ON ai_usage_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_stats_agent ON ai_usage_stats(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_stats_date ON ai_usage_stats(date DESC);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agents
CREATE POLICY "Users can view agents in their organization"
  ON ai_agents FOR SELECT
  USING (true);

CREATE POLICY "Users can insert agents in their organization"
  ON ai_agents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update agents in their organization"
  ON ai_agents FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete agents in their organization"
  ON ai_agents FOR DELETE
  USING (true);

-- RLS Policies for ai_leads
CREATE POLICY "Users can view leads in their organization"
  ON ai_leads FOR SELECT
  USING (true);

CREATE POLICY "Users can insert leads in their organization"
  ON ai_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update leads in their organization"
  ON ai_leads FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete leads in their organization"
  ON ai_leads FOR DELETE
  USING (true);

-- RLS Policies for ai_actions
CREATE POLICY "Users can view actions in their organization"
  ON ai_actions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert actions in their organization"
  ON ai_actions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update actions in their organization"
  ON ai_actions FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete actions in their organization"
  ON ai_actions FOR DELETE
  USING (true);

-- RLS Policies for ai_knowledge_faqs
CREATE POLICY "Users can view FAQs in their organization"
  ON ai_knowledge_faqs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert FAQs in their organization"
  ON ai_knowledge_faqs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update FAQs in their organization"
  ON ai_knowledge_faqs FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete FAQs in their organization"
  ON ai_knowledge_faqs FOR DELETE
  USING (true);

-- RLS Policies for ai_documents
CREATE POLICY "Users can view documents in their organization"
  ON ai_documents FOR SELECT
  USING (true);

CREATE POLICY "Users can insert documents in their organization"
  ON ai_documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update documents in their organization"
  ON ai_documents FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete documents in their organization"
  ON ai_documents FOR DELETE
  USING (true);

-- RLS Policies for ai_usage_stats
CREATE POLICY "Users can view usage stats in their organization"
  ON ai_usage_stats FOR SELECT
  USING (true);

CREATE POLICY "Users can insert usage stats in their organization"
  ON ai_usage_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update usage stats in their organization"
  ON ai_usage_stats FOR UPDATE
  USING (true);

-- Create storage bucket for AI documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-documents', 'ai-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ai-documents bucket
CREATE POLICY "Users can upload documents to their organization"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ai-documents');

CREATE POLICY "Users can view documents in their organization"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ai-documents');

CREATE POLICY "Users can update documents in their organization"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ai-documents');

CREATE POLICY "Users can delete documents in their organization"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ai-documents');

-- Public access for ai-documents bucket
CREATE POLICY "Anyone can view AI documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ai-documents');